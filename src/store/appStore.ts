import { createStore, useStore } from '@/lib/store'
import type {
  Collectible,
  Comment,
  Community,
  CommunityMember,
  Conversation,
  MarketplaceItem,
  Membership,
  Message,
  Notification,
  Post,
  Story,
  TokenAttachment,
  TokenSymbol,
  Toast,
  User,
  WalletState,
} from '@/types'
import {
  seedCollectibles,
  seedCommunities,
  seedMarketplace,
  seedTrends,
  type Trend,
} from '@/data/seed'

/* ------------------------------- UI state ------------------------------- */

export interface TipTarget {
  userId: string
  postId?: string
}

export type WalletSheet = 'connect' | 'send' | 'receive' | 'buy' | 'swap' | 'network' | null

export interface UiState {
  composerOpen: boolean
  composerCommunityId?: string
  /** A launch to attach — the composer opened from a token's thread. */
  composerToken?: TokenAttachment
  tipTarget: TipTarget | null
  collectPostId: string | null
  buyItemId: string | null
  joinCommunityId: string | null
  walletSheet: WalletSheet
  storyIndex: number | null
  commandOpen: boolean
  mobileNavHidden: boolean
}

/** Whether the app has a session and has finished its first load. */
export type SessionStatus = 'loading' | 'signed-out' | 'ready' | 'offline'

export interface AppState {
  /* ---- Server-backed social layer ---- */
  status: SessionStatus
  /** Set when the API cannot be reached, so the UI can say so plainly. */
  connectionError?: string
  me: User | null
  /** Directory cache: every account seen this session, keyed for lookup. */
  users: User[]
  posts: Post[]
  comments: Comment[]
  following: string[]
  conversations: Conversation[]
  messages: Message[]
  notifications: Notification[]
  /** User ids currently connected over the socket. */
  online: string[]
  /** conversationId → user id currently typing, cleared on a timer. */
  typing: Record<string, string | undefined>

  /* ---- Local demo layer (communities, marketplace, wallet) ---- */
  communities: Community[]
  memberships: CommunityMember[]
  credentials: Membership[]
  marketplace: MarketplaceItem[]
  collectibles: Collectible[]
  trends: Trend[]
  stories: Story[]
  wallet: WalletState
  ownershipVerified: boolean

  toasts: Toast[]
  ui: UiState
}

const initialState: AppState = {
  status: 'loading',
  me: null,
  users: [],
  posts: [],
  comments: [],
  following: [],
  conversations: [],
  messages: [],
  notifications: [],
  online: [],
  typing: {},

  communities: seedCommunities,
  memberships: [],
  credentials: [],
  marketplace: seedMarketplace,
  collectibles: seedCollectibles,
  trends: seedTrends,
  stories: [],
  wallet: {
    status: 'disconnected',
    account: null,
    accounts: [],
    balances: [],
    isDemo: true,
  },
  ownershipVerified: false,

  toasts: [],
  ui: {
    composerOpen: false,
    tipTarget: null,
    collectPostId: null,
    buyItemId: null,
    joinCommunityId: null,
    walletSheet: null,
    storyIndex: null,
    commandOpen: false,
    mobileNavHidden: false,
  },
}

export const appStore = createStore<AppState>(initialState)

export const useApp = () => useStore(appStore)

/** Read state outside React (services, event handlers). */
export const getState = () => appStore.get()

export const setUi = (patch: Partial<UiState>) =>
  appStore.set((s) => ({ ...s, ui: { ...s.ui, ...patch } }))

export const setWallet = (patch: Partial<WalletState>) =>
  appStore.set((s) => ({ ...s, wallet: { ...s.wallet, ...patch } }))

/**
 * Merges accounts into the directory cache. Server responses are authoritative,
 * so an incoming copy always replaces the cached one.
 */
export const cacheUsers = (incoming: User[]) =>
  appStore.set((s) => {
    if (!incoming.length) return s
    const byId = new Map(s.users.map((u) => [u.id, u]))
    for (const user of incoming) byId.set(user.id, user)
    const me = incoming.find((u) => u.id === s.me?.id)
    return { ...s, users: [...byId.values()], me: me ?? s.me }
  })

/** Same idea for posts — newest copy wins, ordering by recency is derived. */
export const cachePosts = (incoming: Post[]) =>
  appStore.set((s) => {
    if (!incoming.length) return s
    const byId = new Map(s.posts.map((p) => [p.id, p]))
    for (const post of incoming) byId.set(post.id, post)
    return { ...s, posts: [...byId.values()] }
  })

/* ------------------------------- Selectors ------------------------------- */

/**
 * A placeholder for an account not yet in the directory cache. Rendering an
 * unknown author as "unknown" beats crashing the feed.
 */
const UNKNOWN_USER: User = {
  id: 'unknown',
  handle: 'unknown',
  name: 'Unknown account',
  bio: '',
  avatar: { initials: '?', tone: 11 },
  cover: { scene: 'bloom', tone: 11 },
  verified: false,
  joinedAt: new Date(0).toISOString(),
  followers: 0,
  following: 0,
  postCount: 0,
  isDemo: false,
  followedByMe: false,
  isMe: false,
  reputation: 0,
}

export const selectUser = (s: AppState, id: string): User =>
  s.users.find((u) => u.id === id) ?? (s.me?.id === id ? s.me : UNKNOWN_USER)

export const selectCurrentUser = (s: AppState): User => s.me ?? UNKNOWN_USER

export const selectUserByHandle = (s: AppState, handle: string): User | undefined =>
  s.users.find((u) => u.handle.toLowerCase() === handle.toLowerCase())

export const selectPost = (s: AppState, id: string): Post | undefined =>
  s.posts.find((p) => p.id === id)

export const selectCommunity = (s: AppState, id: string): Community | undefined =>
  s.communities.find((c) => c.id === id)

export const selectCommunityBySlug = (s: AppState, slug: string): Community | undefined =>
  s.communities.find((c) => c.slug === slug)

export const isFollowing = (s: AppState, userId: string): boolean =>
  s.following.includes(userId)

export const isMember = (s: AppState, communityId: string): boolean =>
  s.memberships.some((m) => m.communityId === communityId)

export const selectMembership = (s: AppState, communityId: string): CommunityMember | undefined =>
  s.memberships.find((m) => m.communityId === communityId)

export const selectCredential = (s: AppState, communityId: string): Membership | undefined =>
  s.credentials.find((c) => c.communityId === communityId)

export const selectComments = (s: AppState, postId: string): Comment[] =>
  s.comments
    .filter((c) => c.postId === postId)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))

export const selectConversationMessages = (s: AppState, conversationId: string): Message[] =>
  s.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))

export const selectLastMessage = (s: AppState, conversationId: string): Message | undefined => {
  const list = selectConversationMessages(s, conversationId)
  return list[list.length - 1]
}

export const selectUnreadMessages = (s: AppState): number =>
  s.conversations.reduce((sum, c) => sum + c.unread, 0)

export const selectUnreadNotifications = (s: AppState): number =>
  s.notifications.filter((n) => !n.read).length

const byNewest = (a: Post, b: Post) => +new Date(b.createdAt) - +new Date(a.createdAt)

export const selectFeed = (s: AppState, tab: 'for-you' | 'following' | 'communities'): Post[] => {
  if (tab === 'following') {
    return s.posts
      .filter((p) => s.following.includes(p.authorId) || p.authorId === s.me?.id)
      .sort(byNewest)
  }
  if (tab === 'communities') {
    const joined = s.memberships.map((m) => m.communityId)
    return s.posts.filter((p) => p.communityId && joined.includes(p.communityId)).sort(byNewest)
  }
  return [...s.posts].sort(byNewest)
}

export const selectUserPosts = (s: AppState, userId: string): Post[] =>
  s.posts.filter((p) => p.authorId === userId).sort(byNewest)

export const selectCommunityPosts = (s: AppState, communityId: string): Post[] =>
  s.posts.filter((p) => p.communityId === communityId).sort(byNewest)

export const selectBookmarks = (s: AppState): Post[] =>
  s.posts.filter((p) => p.bookmarkedByMe).sort(byNewest)

export const selectCollectedPosts = (s: AppState): Post[] =>
  s.posts.filter((p) => p.collectible?.collectedByMe).sort(byNewest)

/** Creator earnings across an account's posts. */
export const selectCreatorStats = (s: AppState, userId: string) => {
  const posts = selectUserPosts(s, userId)
  return {
    posts: posts.length,
    tips: posts.reduce((sum, p) => sum + p.tipsReceived, 0),
    collectors: posts.reduce((sum, p) => sum + (p.collectible?.collectors ?? 0), 0),
    earned: posts.reduce((sum, p) => sum + (p.collectible?.earned ?? 0) + p.tipsReceived, 0),
    likes: posts.reduce((sum, p) => sum + p.likes, 0),
  }
}

export const selectBalance = (s: AppState, asset: TokenSymbol) =>
  s.wallet.balances.find((b) => b.symbol === asset)

export const selectMyCommunities = (s: AppState): Community[] =>
  s.memberships
    .map((m) => selectCommunity(s, m.communityId))
    .filter((c): c is Community => !!c)

/** People to follow: everyone except the viewer and accounts already followed. */
export const selectSuggestedUsers = (s: AppState, limit = 3): User[] =>
  s.users
    .filter((u) => u.id !== s.me?.id && !s.following.includes(u.id))
    .sort((a, b) => Number(a.isDemo) - Number(b.isDemo) || b.followers - a.followers)
    .slice(0, limit)

export const selectSuggestedCommunities = (s: AppState, limit = 4): Community[] =>
  s.communities
    .filter((c) => !isMember(s, c.id))
    .sort((a, b) => b.members - a.members)
    .slice(0, limit)

export const isOnline = (s: AppState, userId: string) => s.online.includes(userId)

/**
 * The stories rail.
 *
 * Derived from real posts that carry media rather than invented per-user
 * stories — opening one opens the actual post. A rail of fabricated stories
 * for people who never posted any would be decoration pretending to be content.
 */
export interface StoryCard {
  id: string
  postId: string
  authorId: string
  scene: Post['media'] extends undefined ? never : NonNullable<Post['media']>['scene']
  tone: number
  createdAt: string
  text: string
}

export const selectStories = (s: AppState, limit = 10): StoryCard[] =>
  s.posts
    .filter((p) => p.media && !p.media.src)
    .sort(byNewest)
    .slice(0, limit)
    .map((p) => ({
      id: `story_${p.id}`,
      postId: p.id,
      authorId: p.authorId,
      scene: p.media!.scene,
      tone: p.media!.tone,
      createdAt: p.createdAt,
      text: p.text,
    }))
