import { randomUUID } from 'node:crypto'
import { db, now, pairKey } from './db.js'

/**
 * Query layer. Everything the API returns is shaped here, so route handlers
 * stay thin and no SQL leaks into HTTP concerns.
 *
 * `viewerId` threads through the read paths because most objects carry
 * viewer-relative state — whether *you* liked a post, follow an account, or
 * have unread messages in a conversation.
 */

const json = (value) => (value == null ? null : JSON.stringify(value))
const parse = (value) => {
  if (!value) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

/* --------------------------------- Users --------------------------------- */

const USER_COLUMNS = `
  u.id, u.handle, u.name, u.bio, u.location, u.website,
  u.avatar_tone, u.cover_scene, u.cover_tone, u.verified, u.is_demo,
  u.reputation, u.created_at, u.last_seen_at,
  u.wallet_address, u.wallet_chain_id
`

function shapeUser(row, viewerId) {
  if (!row) return null
  // The post count applies the same visibility rule as the post list, so a
  // profile never advertises posts the viewer is not allowed to see.
  const counts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM follows WHERE followee_id = @user) AS followers,
         (SELECT COUNT(*) FROM follows WHERE follower_id = @user) AS following,
         (SELECT COUNT(*) FROM posts p
            WHERE p.author_id = @user
              AND (p.audience != 'private' OR p.author_id = @viewer)
              AND (p.audience != 'followers' OR p.author_id = @viewer
                   OR EXISTS (SELECT 1 FROM follows f
                              WHERE f.follower_id = @viewer AND f.followee_id = p.author_id))
         ) AS posts`,
    )
    .get({ user: row.id, viewer: viewerId ?? '' })

  const followsBack = viewerId
    ? !!db
        .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?')
        .get(viewerId, row.id)
    : false

  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    bio: row.bio ?? '',
    location: row.location ?? undefined,
    website: row.website ?? undefined,
    avatar: { initials: initialsFor(row.name), tone: row.avatar_tone },
    cover: { scene: row.cover_scene, tone: row.cover_tone },
    verified: !!row.verified,
    isDemo: !!row.is_demo,
    reputation: row.reputation ?? 0,
    joinedAt: row.created_at,
    lastSeenAt: row.last_seen_at ?? undefined,
    walletAddress: row.wallet_address ?? undefined,
    walletChainId: row.wallet_chain_id ?? undefined,
    followers: counts.followers,
    following: counts.following,
    postCount: counts.posts,
    followedByMe: followsBack,
    isMe: viewerId === row.id,
  }
}

const initialsFor = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

export function getUserById(id, viewerId) {
  return shapeUser(
    db.prepare(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`).get(id),
    viewerId,
  )
}

export function getUserByHandle(handle, viewerId) {
  return shapeUser(
    db
      .prepare(`SELECT ${USER_COLUMNS} FROM users u WHERE u.handle_lower = ?`)
      .get((handle ?? '').toLowerCase()),
    viewerId,
  )
}

/**
 * The people directory. Everyone who has signed up is discoverable; real
 * accounts sort above demo personas so a new instance still feels populated
 * without burying the people actually using it.
 */
export function listUsers({ q = '', viewerId, limit = 50 }) {
  const term = `%${q.trim().toLowerCase()}%`
  const rows = db
    .prepare(
      `SELECT ${USER_COLUMNS} FROM users u
       WHERE (? = '' OR LOWER(u.name) LIKE ? OR u.handle_lower LIKE ? OR LOWER(u.bio) LIKE ?)
       ORDER BY u.is_demo ASC, u.last_seen_at DESC NULLS LAST, u.created_at DESC
       LIMIT ?`,
    )
    .all(q.trim(), term, term, term, limit)
  return rows.map((row) => shapeUser(row, viewerId))
}

export function updateProfile(userId, patch) {
  const fields = []
  const values = []
  for (const [column, value] of Object.entries({
    name: patch.name,
    bio: patch.bio,
    location: patch.location,
    website: patch.website,
  })) {
    if (value !== undefined) {
      fields.push(`${column} = ?`)
      values.push(value === '' ? null : value)
    }
  }
  if (!fields.length) return
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values, userId)
}

export function touchLastSeen(userId) {
  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), userId)
}

/* -------------------------------- Follows -------------------------------- */

export function follow(followerId, followeeId) {
  if (followerId === followeeId) return false
  db.prepare(
    'INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)',
  ).run(followerId, followeeId, now())
  return true
}

export function unfollow(followerId, followeeId) {
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(
    followerId,
    followeeId,
  )
}

export function listFollowing(userId) {
  return db
    .prepare('SELECT followee_id FROM follows WHERE follower_id = ?')
    .all(userId)
    .map((r) => r.followee_id)
}

/* --------------------------------- Posts --------------------------------- */

const REACTION_KINDS = ['like', 'repost', 'bookmark', 'collect']

function shapePost(row, viewerId) {
  const counts = db
    .prepare(
      `SELECT kind, COUNT(*) AS n FROM post_reactions WHERE post_id = ? GROUP BY kind`,
    )
    .all(row.id)
  const by = Object.fromEntries(counts.map((c) => [c.kind, c.n]))

  const mine = viewerId
    ? db
        .prepare('SELECT kind FROM post_reactions WHERE post_id = ? AND user_id = ?')
        .all(row.id, viewerId)
        .map((r) => r.kind)
    : []

  const commentCount = db
    .prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id = ?')
    .get(row.id).n

  const tips = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM tips WHERE post_id = ?')
    .get(row.id).total

  const collect = parse(row.collect_json)

  return {
    id: row.id,
    authorId: row.author_id,
    text: row.text,
    media: parse(row.media_json),
    poll: parse(row.poll_json),
    event: parse(row.event_json),
    token: parse(row.token_json) ?? undefined,
    audience: row.audience,
    location: row.location ?? undefined,
    communityId: row.community_id ?? undefined,
    createdAt: row.created_at,
    likes: by.like ?? 0,
    reposts: by.repost ?? 0,
    comments: commentCount,
    tipsReceived: tips,
    likedByMe: mine.includes('like'),
    repostedByMe: mine.includes('repost'),
    bookmarkedByMe: mine.includes('bookmark'),
    collectible: collect
      ? {
          ...collect,
          collectors: by.collect ?? 0,
          earned: Number(((by.collect ?? 0) * collect.price * 0.95).toFixed(2)),
          collectedByMe: mine.includes('collect'),
        }
      : undefined,
  }
}

const POST_COLUMNS = `p.id, p.author_id, p.text, p.media_json, p.poll_json, p.event_json, p.collect_json,
  p.token_json, p.audience, p.location, p.community_id, p.created_at`

/**
 * The feed.
 *
 * `following` narrows to accounts the viewer follows (plus their own posts).
 * Private posts are only ever returned to their author, and followers-only
 * posts only to the author's followers — the visibility rule lives here rather
 * than being trusted to the client.
 */
export function listPosts({ viewerId, scope = 'for-you', authorId, limit = 100 }) {
  const conditions = [
    `(p.audience != 'private' OR p.author_id = @viewer)`,
    `(p.audience != 'followers' OR p.author_id = @viewer
       OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = @viewer AND f.followee_id = p.author_id))`,
  ]
  if (authorId) conditions.push('p.author_id = @authorId')
  if (scope === 'following') {
    conditions.push(
      `(p.author_id = @viewer
        OR EXISTS (SELECT 1 FROM follows f2 WHERE f2.follower_id = @viewer AND f2.followee_id = p.author_id))`,
    )
  }

  // node:sqlite rejects named parameters the statement does not reference, so
  // the bindings are built to match exactly the placeholders that were added.
  const params = { viewer: viewerId ?? '', limit }
  if (authorId) params.authorId = authorId

  const rows = db
    .prepare(
      `SELECT ${POST_COLUMNS} FROM posts p
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.created_at DESC
       LIMIT @limit`,
    )
    .all(params)

  return rows.map((row) => shapePost(row, viewerId))
}

export function getPost(id, viewerId) {
  const row = db.prepare(`SELECT ${POST_COLUMNS} FROM posts p WHERE p.id = ?`).get(id)
  return row ? shapePost(row, viewerId) : null
}

/**
 * The token attachment a post may carry, reduced to the fields a card renders.
 * Addresses are stored as given; the chain is the source of truth for the rest,
 * so nothing here is trusted beyond being a pointer.
 */
function shapeTokenAttachment(token) {
  if (!token || typeof token !== 'object') return null
  const hex = (v) => (typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v) ? v : null)
  const address = hex(token.address)
  const curve = hex(token.curve)
  if (!address || !curve) return null
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
  return {
    chainId: Number.isInteger(token.chainId) ? token.chainId : 0,
    address,
    curve,
    name: str(token.name, 64),
    symbol: str(token.symbol, 16),
    quoteSymbol: str(token.quoteSymbol, 16),
    logo: str(token.logo, 512) || undefined,
    launchTx:
      typeof token.launchTx === 'string' && /^0x[0-9a-fA-F]{64}$/.test(token.launchTx)
        ? token.launchTx
        : undefined,
  }
}

export function createPost(authorId, draft) {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO posts (id, author_id, text, media_json, poll_json, event_json, collect_json,
                        token_json, audience, location, community_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    authorId,
    (draft.text ?? '').slice(0, 2000),
    json(draft.media ?? null),
    json(draft.poll ?? null),
    json(draft.event ?? null),
    json(draft.collectible ?? null),
    json(shapeTokenAttachment(draft.token)),
    draft.audience ?? 'everyone',
    draft.location ?? null,
    draft.communityId ?? null,
    now(),
  )
  return getPost(id, authorId)
}

export function deletePost(id, authorId) {
  const result = db
    .prepare('DELETE FROM posts WHERE id = ? AND author_id = ?')
    .run(id, authorId)
  return result.changes > 0
}

/** Sets or clears one reaction. Returns false for an unrecognised kind. */
export function setReaction(postId, userId, kind, on) {
  if (!REACTION_KINDS.includes(kind)) return false
  if (on) {
    db.prepare(
      'INSERT OR IGNORE INTO post_reactions (post_id, user_id, kind, created_at) VALUES (?, ?, ?, ?)',
    ).run(postId, userId, kind, now())
  } else {
    db.prepare(
      'DELETE FROM post_reactions WHERE post_id = ? AND user_id = ? AND kind = ?',
    ).run(postId, userId, kind)
  }
  return true
}

/** Posts the viewer has bookmarked or collected — the private "Saved" shelf. */
export function listReactedPosts(userId, kind) {
  const rows = db
    .prepare(
      `SELECT ${POST_COLUMNS} FROM posts p
       JOIN post_reactions r ON r.post_id = p.id AND r.user_id = ? AND r.kind = ?
       ORDER BY r.created_at DESC`,
    )
    .all(userId, kind)
  return rows.map((row) => shapePost(row, userId))
}

export function recordTip({ postId, fromUser, toUser, amount, asset, settlement }) {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO tips (id, post_id, from_user, to_user, amount, asset, settlement, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, postId ?? null, fromUser, toUser, amount, asset, settlement, now())
  return id
}

const shapeComment = (row, viewerId) => ({
  id: row.id,
  postId: row.post_id,
  authorId: row.author_id,
  text: row.text,
  createdAt: row.created_at,
  likes: db.prepare('SELECT COUNT(*) AS n FROM comment_likes WHERE comment_id = ?').get(row.id).n,
  likedByMe: viewerId
    ? !!db
        .prepare('SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?')
        .get(row.id, viewerId)
    : false,
})

export function listComments(postId, viewerId) {
  return db
    .prepare(
      `SELECT id, post_id, author_id, text, created_at
       FROM comments WHERE post_id = ? ORDER BY created_at ASC`,
    )
    .all(postId)
    .map((row) => shapeComment(row, viewerId))
}

export function addComment(postId, authorId, text) {
  const id = randomUUID()
  const createdAt = now()
  const body = text.slice(0, 1000)
  db.prepare(
    'INSERT INTO comments (id, post_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, postId, authorId, body, createdAt)
  return { id, postId, authorId, text: body, createdAt, likes: 0, likedByMe: false }
}

export function setCommentLike(commentId, userId, liked) {
  const exists = db.prepare('SELECT 1 FROM comments WHERE id = ?').get(commentId)
  if (!exists) return false
  if (liked) {
    db.prepare(
      'INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)',
    ).run(commentId, userId, now())
  } else {
    db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?').run(
      commentId,
      userId,
    )
  }
  return true
}

/* ------------------------------ Conversations ----------------------------- */

/** Finds the DM between two people, creating it on first message. */
export function ensureConversation(a, b) {
  const key = pairKey(a, b)
  const existing = db.prepare('SELECT id FROM conversations WHERE pair_key = ?').get(key)
  if (existing) return existing.id

  const id = randomUUID()
  db.prepare('INSERT INTO conversations (id, pair_key, created_at) VALUES (?, ?, ?)').run(
    id,
    key,
    now(),
  )
  const addMember = db.prepare(
    'INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, ?)',
  )
  addMember.run(id, a, now())
  addMember.run(id, b, null)
  return id
}

export function listConversations(userId) {
  const rows = db
    .prepare(
      `SELECT c.id, c.created_at, cm.last_read_at
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
       ORDER BY COALESCE(
         (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = c.id),
         c.created_at
       ) DESC`,
    )
    .all(userId)

  return rows.map((row) => {
    const other = db
      .prepare(
        'SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?',
      )
      .get(row.id, userId)

    const last = db
      .prepare(
        `SELECT id, sender_id, text, attachment_json, created_at
         FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(row.id)

    const unread = db
      .prepare(
        `SELECT COUNT(*) AS n FROM messages
         WHERE conversation_id = ? AND sender_id != ?
           AND (? IS NULL OR created_at > ?)`,
      )
      .get(row.id, userId, row.last_read_at, row.last_read_at).n

    return {
      id: row.id,
      participantIds: other ? [other.user_id] : [],
      unread,
      lastMessageAt: last?.created_at ?? row.created_at,
      lastMessage: last
        ? {
            id: last.id,
            senderId: last.sender_id,
            text: last.text,
            attachment: parse(last.attachment_json),
            createdAt: last.created_at,
          }
        : undefined,
    }
  })
}

export function isMember(conversationId, userId) {
  return !!db
    .prepare(
      'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
    )
    .get(conversationId, userId)
}

export function listMessages(conversationId, limit = 200) {
  return db
    .prepare(
      `SELECT id, conversation_id, sender_id, text, attachment_json, created_at
       FROM messages WHERE conversation_id = ?
       ORDER BY created_at ASC LIMIT ?`,
    )
    .all(conversationId, limit)
    .map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      text: row.text,
      attachment: parse(row.attachment_json),
      createdAt: row.created_at,
    }))
}

export function addMessage(conversationId, senderId, text, attachment) {
  const id = randomUUID()
  const createdAt = now()
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, text, attachment_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, conversationId, senderId, (text ?? '').slice(0, 4000), json(attachment ?? null), createdAt)

  // Sending is also reading.
  db.prepare(
    'UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?',
  ).run(createdAt, conversationId, senderId)

  return { id, conversationId, senderId, text: (text ?? '').slice(0, 4000), attachment, createdAt }
}

export function markRead(conversationId, userId) {
  db.prepare(
    'UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?',
  ).run(now(), conversationId, userId)
}

export function conversationMembers(conversationId) {
  return db
    .prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ?')
    .all(conversationId)
    .map((r) => r.user_id)
}

/* ----------------------------- Notifications ----------------------------- */

export function addNotification({ userId, kind, actorId, postId, text }) {
  if (userId === actorId) return null
  const id = randomUUID()
  const createdAt = now()
  db.prepare(
    `INSERT INTO notifications (id, user_id, kind, actor_id, post_id, text, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(id, userId, kind, actorId ?? null, postId ?? null, text ?? null, createdAt)
  return { id, userId, kind, actorId, postId, text, read: false, createdAt }
}

export function listNotifications(userId, limit = 100) {
  return db
    .prepare(
      `SELECT id, kind, actor_id, post_id, text, read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(userId, limit)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      actorId: row.actor_id ?? undefined,
      postId: row.post_id ?? undefined,
      text: row.text ?? undefined,
      read: !!row.read,
      createdAt: row.created_at,
    }))
}

export function markNotificationsRead(userId, id) {
  if (id) {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?').run(userId, id)
  } else {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId)
  }
}

/* ------------------------------ Wallet link ------------------------------ */

/**
 * Links a verified address to an account.
 *
 * Only called after the signature over the issued nonce has been checked, so
 * a row here always means the account proved control of the key.
 */
export function linkWallet(userId, address, chainId) {
  db.prepare(
    'UPDATE users SET wallet_address = ?, wallet_chain_id = ?, wallet_linked_at = ? WHERE id = ?',
  ).run(address, chainId ?? null, now(), userId)
}

export function unlinkWallet(userId) {
  db.prepare(
    'UPDATE users SET wallet_address = NULL, wallet_chain_id = NULL, wallet_linked_at = NULL WHERE id = ?',
  ).run(userId)
}

/** An address may only be claimed by one account at a time. */
export function addressClaimedBy(address) {
  const row = db
    .prepare('SELECT id FROM users WHERE LOWER(wallet_address) = LOWER(?)')
    .get(address)
  return row?.id ?? null
}

export function issueNonce(userId) {
  const nonce = randomUUID().replace(/-/g, '')
  db.prepare(
    'INSERT INTO wallet_nonces (nonce, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(nonce, userId, now(), new Date(Date.now() + 5 * 60_000).toISOString())
  return nonce
}

/** Consumes a nonce. Returns false if it is unknown, expired or not theirs. */
export function consumeNonce(userId, nonce) {
  const row = db.prepare('SELECT user_id, expires_at FROM wallet_nonces WHERE nonce = ?').get(nonce)
  db.prepare('DELETE FROM wallet_nonces WHERE nonce = ?').run(nonce)
  if (!row || row.user_id !== userId) return false
  return new Date(row.expires_at) > new Date()
}
