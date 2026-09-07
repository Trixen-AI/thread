import type {
  Message,
  MessageAttachment,
  Post,
  PostDraft,
} from '@/types'
import { patchById } from '@/lib/store'
import { ApiError, api, tokenStore, type ReactionKind } from '@/services/api/client'
import { reportError, toast } from './toast'
import * as realtime from '@/services/api/realtime'
import {
  appStore,
  cachePosts,
  cacheUsers,
  getState,
  selectPost,
  selectUser,
  setUi,
} from './appStore'

/* --------------------------------- Session -------------------------------- */

/**
 * Boots the session.
 *
 * Validates any stored token against the server, loads the first page of every
 * social surface, then opens the live socket. A failure here is reported as a
 * connection problem rather than silently showing an empty app.
 */
export async function bootstrap() {
  if (!tokenStore.get()) {
    appStore.set((s) => ({ ...s, status: 'signed-out' }))
    return
  }

  try {
    const { user, following } = await api.me()
    appStore.set((s) => ({ ...s, me: user, following, status: 'ready' }))
    cacheUsers([user])
    await refreshAll()
    openSocket()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      tokenStore.set(null)
      appStore.set((s) => ({ ...s, status: 'signed-out', me: null }))
    } else {
      appStore.set((s) => ({
        ...s,
        status: 'offline',
        connectionError:
          error instanceof ApiError ? error.message : 'Cannot reach the MESH server',
      }))
    }
  }
}

async function completeAuth(result: { token: string; user: import('@/types').User }) {
  tokenStore.set(result.token)
  appStore.set((s) => ({ ...s, me: result.user, status: 'ready', connectionError: undefined }))
  cacheUsers([result.user])
  await refreshAll()
  openSocket()
}

export async function register(input: { handle: string; name: string; password: string }) {
  const result = await api.register(input)
  await completeAuth(result)
  toast({
    title: `Welcome to MESH, ${result.user.name.split(' ')[0]}`,
    description: 'Find people in Explore and start following them.',
    tone: 'brand',
    icon: 'users',
  })
}

export async function signIn(input: { handle: string; password: string }) {
  const result = await api.login(input)
  await completeAuth(result)
}

export async function signOut() {
  realtime.disconnect()
  try {
    await api.logout()
  } catch {
    /* the local session is cleared regardless */
  }
  tokenStore.set(null)
  appStore.set((s) => ({
    ...s,
    status: 'signed-out',
    me: null,
    users: [],
    posts: [],
    comments: [],
    following: [],
    conversations: [],
    messages: [],
    notifications: [],
    online: [],
  }))
}

/** Loads everything the shell needs. Failures are surfaced, not swallowed. */
export async function refreshAll() {
  try {
    const [feed, directory, conversations, notifications] = await Promise.all([
      api.posts('for-you'),
      api.users(),
      api.conversations(),
      api.notifications(),
    ])
    cachePosts(feed.posts)
    cacheUsers(directory.users)
    appStore.set((s) => ({
      ...s,
      conversations: conversations.conversations,
      notifications: notifications.notifications,
      connectionError: undefined,
    }))
  } catch (error) {
    reportError(error, 'Could not refresh')
  }
}

export async function refreshFeed(scope: 'for-you' | 'following' = 'for-you') {
  try {
    const { posts } = await api.posts(scope)
    cachePosts(posts)
  } catch (error) {
    reportError(error, 'Could not load the feed')
  }
}

/* -------------------------------- Realtime -------------------------------- */

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>()

function openSocket() {
  realtime.connect((event) => {
    switch (event.type) {
      case 'ready':
      case 'presence':
        appStore.set((s) => ({ ...s, online: event.online }))
        break

      case 'message': {
        const state = getState()
        const mine = event.message.senderId === state.me?.id
        appStore.set((s) => {
          if (s.messages.some((m) => m.id === event.message.id)) return s
          return {
            ...s,
            messages: [...s.messages, event.message],
            conversations: s.conversations.map((c) =>
              c.id === event.message.conversationId
                ? {
                    ...c,
                    lastMessageAt: event.message.createdAt,
                    // Don't mark unread for a thread the user is reading.
                    unread:
                      mine || s.ui.mobileNavHidden ? c.unread : c.unread + (mine ? 0 : 1),
                  }
                : c,
            ),
          }
        })
        // A message from someone the viewer has no conversation row for yet.
        if (!getState().conversations.some((c) => c.id === event.message.conversationId)) {
          void syncConversations()
        }
        break
      }

      case 'notification':
        appStore.set((s) => ({ ...s, notifications: [event.notification, ...s.notifications] }))
        break

      case 'post':
        cachePosts([event.post])
        cacheUsers([]) // authors arrive with the next directory refresh
        break

      case 'typing': {
        const key = event.conversationId
        appStore.set((s) => ({ ...s, typing: { ...s.typing, [key]: event.userId } }))
        clearTimeout(typingTimers.get(key))
        typingTimers.set(
          key,
          setTimeout(() => {
            appStore.set((s) => ({ ...s, typing: { ...s.typing, [key]: undefined } }))
          }, 3000),
        )
        break
      }
    }
  })
}

export const notifyTyping = realtime.sendTyping

/* ------------------------------ Post reactions ---------------------------- */

/**
 * Applies a reaction optimistically, then reconciles with the server's count.
 * On failure the optimistic change is rolled back by re-reading the post.
 */
async function react(postId: string, kind: ReactionKind, on: boolean, optimistic: Partial<Post>) {
  appStore.set((s) => ({ ...s, posts: patchById(s.posts, postId, optimistic) }))
  try {
    const { post } = await api.react(postId, kind, on)
    cachePosts([post])
  } catch (error) {
    reportError(error, 'Could not save that')
    try {
      const { post } = await api.post(postId)
      cachePosts([post])
    } catch {
      /* leave the optimistic value if the post cannot be re-read */
    }
  }
}

export function toggleLike(postId: string) {
  const post = selectPost(getState(), postId)
  if (!post) return
  const on = !post.likedByMe
  void react(postId, 'like', on, { likedByMe: on, likes: post.likes + (on ? 1 : -1) })
}

export function toggleRepost(postId: string) {
  const post = selectPost(getState(), postId)
  if (!post) return
  const on = !post.repostedByMe
  void react(postId, 'repost', on, { repostedByMe: on, reposts: post.reposts + (on ? 1 : -1) })
  toast({
    title: on ? 'Reposted to your profile' : 'Repost removed',
    tone: 'default',
    icon: 'check',
  })
}

export function toggleBookmark(postId: string) {
  const post = selectPost(getState(), postId)
  if (!post) return
  const on = !post.bookmarkedByMe
  void react(postId, 'bookmark', on, { bookmarkedByMe: on })
  toast({
    title: on ? 'Saved' : 'Removed from saved',
    description: on ? 'Find it again in Saved posts.' : undefined,
    tone: 'default',
    icon: 'check',
  })
}

export async function loadComments(postId: string) {
  try {
    const { comments } = await api.comments(postId)
    appStore.set((s) => ({
      ...s,
      comments: [...s.comments.filter((c) => c.postId !== postId), ...comments],
    }))
  } catch (error) {
    reportError(error, 'Could not load comments')
  }
}

export async function addComment(postId: string, text: string) {
  if (!text.trim()) return
  try {
    const { comment, post } = await api.addComment(postId, text.trim())
    appStore.set((s) => ({ ...s, comments: [...s.comments, comment] }))
    cachePosts([post])
    return comment
  } catch (error) {
    reportError(error, 'Could not post that comment')
  }
}

export function toggleCommentLike(commentId: string) {
  const comment = getState().comments.find((c) => c.id === commentId)
  if (!comment) return
  const liked = !comment.likedByMe

  appStore.set((s) => ({
    ...s,
    comments: patchById(s.comments, commentId, {
      likedByMe: liked,
      likes: comment.likes + (liked ? 1 : -1),
    }),
  }))
  api.likeComment(commentId, liked).catch(() => {
    appStore.set((s) => ({
      ...s,
      comments: patchById(s.comments, commentId, {
        likedByMe: comment.likedByMe,
        likes: comment.likes,
      }),
    }))
  })
}

/** Polls and event RSVPs are view-local: the server stores the definition only. */
export function votePoll(postId: string, optionId: string) {
  appStore.set((s) => ({
    ...s,
    posts: patchById(s.posts, postId, (p) => {
      if (!p.poll || p.poll.votedOptionId) return {}
      return {
        poll: {
          ...p.poll,
          votedOptionId: optionId,
          options: p.poll.options.map((o) =>
            o.id === optionId ? { ...o, votes: o.votes + 1 } : o,
          ),
        },
      }
    }),
  }))
}

export function toggleAttending(postId: string) {
  appStore.set((s) => ({
    ...s,
    posts: patchById(s.posts, postId, (p) => {
      if (!p.event) return {}
      const going = !p.event.isAttending
      return {
        event: { ...p.event, isAttending: going, attending: p.event.attending + (going ? 1 : -1) },
      }
    }),
  }))
}

/* ------------------------------- Publishing ------------------------------- */

export async function createPost(draft: PostDraft): Promise<Post | undefined> {
  try {
    const { post } = await api.createPost(draft)
    cachePosts([post])
    toast({
      title: 'Post published',
      description: draft.collectible
        ? `Collectible at ${draft.collectible.price} ${draft.collectible.asset}.`
        : 'Your post is live for everyone following you.',
      tone: 'success',
      icon: 'check',
    })
    return post
  } catch (error) {
    reportError(error, 'Could not publish')
  }
}

export async function deletePost(postId: string) {
  try {
    await api.deletePost(postId)
    appStore.set((s) => ({
      ...s,
      posts: s.posts.filter((p) => p.id !== postId),
      comments: s.comments.filter((c) => c.postId !== postId),
    }))
    toast({ title: 'Post deleted', tone: 'default', icon: 'check' })
  } catch (error) {
    reportError(error, 'Could not delete that post')
  }
}

/* -------------------------------- Follows -------------------------------- */

export async function toggleFollow(userId: string) {
  const state = getState()
  const wasFollowing = state.following.includes(userId)
  const user = selectUser(state, userId)

  // Optimistic: the button must feel instant.
  appStore.set((s) => ({
    ...s,
    following: wasFollowing ? s.following.filter((id) => id !== userId) : [...s.following, userId],
    users: patchById(s.users, userId, (u) => ({
      followedByMe: !wasFollowing,
      followers: u.followers + (wasFollowing ? -1 : 1),
    })),
  }))

  try {
    const { user: updated } = await api.setFollow(userId, !wasFollowing)
    cacheUsers([updated])
    if (!wasFollowing) {
      toast({ title: `Following ${user.name}`, tone: 'brand', icon: 'users' })
      void refreshFeed()
    }
  } catch (error) {
    appStore.set((s) => ({
      ...s,
      following: wasFollowing
        ? [...s.following, userId]
        : s.following.filter((id) => id !== userId),
      users: patchById(s.users, userId, { followedByMe: wasFollowing, followers: user.followers }),
    }))
    reportError(error, 'Could not update follow')
  }
}

/* --------------------------------- People -------------------------------- */

export async function searchPeople(query: string) {
  try {
    const { users } = await api.users(query)
    cacheUsers(users)
    return users
  } catch {
    return []
  }
}

export async function loadProfile(handle: string) {
  try {
    const { user, posts } = await api.profile(handle)
    cacheUsers([user])
    cachePosts(posts)
    return user
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      reportError(error, 'Could not load that profile')
    }
    return null
  }
}

export async function updateProfile(patch: {
  name?: string
  bio?: string
  location?: string
  website?: string
}) {
  try {
    const { user } = await api.updateProfile(patch)
    cacheUsers([user])
    appStore.set((s) => ({ ...s, me: user }))
    toast({ title: 'Profile saved', tone: 'success', icon: 'check' })
    return true
  } catch (error) {
    reportError(error, 'Could not save your profile')
    return false
  }
}

/* -------------------------------- Messaging ------------------------------- */

export async function syncConversations() {
  try {
    const { conversations } = await api.conversations()
    appStore.set((s) => ({ ...s, conversations }))
  } catch (error) {
    reportError(error, 'Could not load conversations')
  }
}

export async function loadMessages(conversationId: string) {
  try {
    const { messages } = await api.messages(conversationId)
    appStore.set((s) => ({
      ...s,
      messages: [
        ...s.messages.filter((m) => m.conversationId !== conversationId),
        ...messages,
      ],
      conversations: patchById(s.conversations, conversationId, { unread: 0 }),
    }))
  } catch (error) {
    reportError(error, 'Could not open that conversation')
  }
}

export async function sendMessage(
  conversationId: string,
  text: string,
  attachment?: MessageAttachment,
): Promise<Message | undefined> {
  if (!text.trim() && !attachment) return
  try {
    const { message } = await api.sendMessage(conversationId, text.trim(), attachment)
    // The socket echoes it back too; the id check there prevents a duplicate.
    appStore.set((s) =>
      s.messages.some((m) => m.id === message.id)
        ? s
        : { ...s, messages: [...s.messages, message] },
    )
    return message
  } catch (error) {
    reportError(error, 'Could not send that message')
  }
}

export function markConversationRead(conversationId: string) {
  const conversation = getState().conversations.find((c) => c.id === conversationId)
  if (!conversation || conversation.unread === 0) return
  appStore.set((s) => ({
    ...s,
    conversations: patchById(s.conversations, conversationId, { unread: 0 }),
  }))
  api.markConversationRead(conversationId).catch(() => void syncConversations())
}

/** Opens (or finds) the DM with someone. Returns the conversation id. */
export async function openConversationWith(userId: string): Promise<string | null> {
  try {
    const { conversationId, conversations } = await api.openConversation(userId)
    appStore.set((s) => ({ ...s, conversations }))
    return conversationId
  } catch (error) {
    reportError(error, 'Could not start that conversation')
    return null
  }
}

export function toggleMuteConversation(conversationId: string) {
  appStore.set((s) => ({
    ...s,
    conversations: patchById(s.conversations, conversationId, (c) => ({ muted: !c.muted })),
  }))
}

/* ------------------------------ Notifications ----------------------------- */

export function markNotificationRead(id: string) {
  appStore.set((s) => ({ ...s, notifications: patchById(s.notifications, id, { read: true }) }))
  api.markNotificationsRead(id).catch(() => {})
}

export function markAllNotificationsRead() {
  appStore.set((s) => ({
    ...s,
    notifications: s.notifications.map((n) => (n.read ? n : { ...n, read: true })),
  }))
  api.markNotificationsRead().catch(() => {})
  toast({ title: 'All caught up', tone: 'default', icon: 'check' })
}

/* --------------------------------- Stories -------------------------------- */

export const openStory = (index: number) => setUi({ storyIndex: index })
export const closeStory = () => setUi({ storyIndex: null })

export function markStorySeen(storyId: string) {
  appStore.set((s) => ({ ...s, stories: patchById(s.stories, storyId, { seen: true }) }))
}


/* --------------------------------------------------------------------- */

// The wallet, payments and the local community layer live next door; they are
// re-exported so callers keep importing actions from one place.
export * from './toast'
export * from './walletActions'
export * from './ponsActions'
