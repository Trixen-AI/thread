import { createServer } from 'node:http'
import express from 'express'
import { WebSocketServer } from 'ws'
import { getAddress, verifyMessage } from 'viem'
import {
  createSession,
  createUser,
  destroySession,
  handleTaken,
  recordAttempt,
  tooManyAttempts,
  userIdForToken,
  validateCredentials,
  verifyPassword,
} from './auth.js'
import * as repo from './repo.js'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, uploadHandler } from './pinata.js'
import { seedIfEmpty } from './seed.js'

/**
 * Most hosts choose the port and pass it as PORT, then check that something is
 * listening on it — so that is read before the MESH-specific name, and 8787 is
 * only the local default. Binding the wrong port is the usual reason a deploy
 * comes up healthy in the logs and dead from outside.
 */
const PORT = Number(process.env.MESH_API_PORT ?? process.env.PORT ?? 8787)
const HOST = process.env.MESH_API_HOST ?? '0.0.0.0'

const app = express()
app.use(express.json({ limit: '1mb' }))

/* --------------------------------- CORS --------------------------------- */

/**
 * Origins allowed to call this API from a browser.
 *
 * Empty by default, which is the same-origin case: the dev server proxies
 * `/api`, and a single-host deployment needs no cross-origin permission at all.
 * Set `MESH_ALLOWED_ORIGINS` to a comma-separated list when the front end is
 * hosted apart from the API — a static host, say.
 *
 * The list is explicit rather than a wildcard. A session here is a bearer token
 * in a header, so any page that may call this API can also read the answer, and
 * "any origin" would mean any site on the internet acting for a signed-in user.
 */
const ALLOWED_ORIGINS = new Set(
  (process.env.MESH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean),
)

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.has(origin.replace(/\/+$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    // The answer varies by origin, so a cache must key on it.
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '600')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

/* ------------------------------ Middleware ------------------------------ */

const bearer = (req) => {
  const header = req.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

/** Attaches `req.userId` when a valid session token is present. */
function authenticate(req, _res, next) {
  req.userId = userIdForToken(bearer(req))
  next()
}

function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Sign in to continue' })
  next()
}

app.use(authenticate)

const fail = (res, status, error, fields) => res.status(status).json({ error, fields })

/* --------------------------------- Uploads --------------------------------- */

/**
 * A token image, on its way to IPFS. Signed in only — this pins to an account
 * pons never sees, and an open endpoint would be someone else's storage bill.
 *
 * The raw parser is scoped to this route so the JSON parser keeps handling
 * everything else.
 */
app.post(
  '/api/upload',
  requireAuth,
  express.raw({ type: ACCEPTED_IMAGE_TYPES, limit: MAX_IMAGE_BYTES }),
  uploadHandler,
)

/* --------------------------------- Auth --------------------------------- */

app.post('/api/auth/register', (req, res) => {
  const { handle, name, password } = req.body ?? {}
  const check = validateCredentials({ handle, name, password })
  if (!check.ok) return fail(res, 400, 'Check the highlighted fields', check.errors)
  if (handleTaken(check.handle)) {
    return fail(res, 409, 'That handle is taken', { handle: 'Someone already has this handle.' })
  }

  const id = createUser({ handle: check.handle, name, password })
  const token = createSession(id)
  res.status(201).json({ token, user: repo.getUserById(id, id) })
})

app.post('/api/auth/login', (req, res) => {
  const { handle, password } = req.body ?? {}
  const key = `${(handle ?? '').toLowerCase()}|${req.ip}`

  if (tooManyAttempts(key)) {
    return fail(res, 429, 'Too many attempts. Try again in a few minutes.')
  }

  const id = verifyPassword(handle, password ?? '')
  recordAttempt(key, !!id)
  // One message for both cases, so the endpoint cannot confirm which handles exist.
  if (!id) return fail(res, 401, 'That handle and password do not match')

  repo.touchLastSeen(id)
  res.json({ token: createSession(id), user: repo.getUserById(id, id) })
})

app.post('/api/auth/logout', (req, res) => {
  destroySession(bearer(req))
  res.json({ ok: true })
})

app.get('/api/auth/handle-available', (req, res) => {
  const handle = String(req.query.handle ?? '')
  const check = validateCredentials({ handle, name: 'x', password: 'xxxxxxxx' })
  res.json({
    available: check.errors.handle ? false : !handleTaken(check.handle),
    reason: check.errors.handle,
  })
})

/* --------------------------------- Me ----------------------------------- */

app.get('/api/me', requireAuth, (req, res) => {
  repo.touchLastSeen(req.userId)
  res.json({
    user: repo.getUserById(req.userId, req.userId),
    following: repo.listFollowing(req.userId),
  })
})

app.patch('/api/me', requireAuth, (req, res) => {
  const { name, bio, location, website } = req.body ?? {}
  if (name !== undefined && (!name.trim() || name.length > 40)) {
    return fail(res, 400, 'Invalid name', { name: 'Enter 1–40 characters.' })
  }
  repo.updateProfile(req.userId, {
    name: name?.trim(),
    bio: bio?.slice(0, 300),
    location: location?.slice(0, 60),
    website: website?.slice(0, 100),
  })
  res.json({ user: repo.getUserById(req.userId, req.userId) })
})

/* ------------------------------ Wallet link ------------------------------ */

/**
 * Linking an address is a challenge–response, not a claim.
 *
 * The server issues a single-use nonce, the wallet signs a message containing
 * it, and the signature is recovered here. An address is stored only when the
 * recovered signer matches the address being claimed — so nobody can attach
 * someone else's wallet to their profile by typing it in.
 */
app.post('/api/wallet/nonce', requireAuth, (req, res) => {
  const nonce = repo.issueNonce(req.userId)
  const user = repo.getUserById(req.userId, req.userId)
  const issuedAt = new Date().toISOString()
  res.json({
    nonce,
    message: [
      `MESH wants to link this wallet to @${user.handle}.`,
      '',
      'Signing costs nothing and does not authorise any transaction.',
      '',
      `Nonce: ${nonce}`,
      `Issued: ${issuedAt}`,
    ].join('\n'),
  })
})

app.post('/api/wallet/link', requireAuth, async (req, res) => {
  const { address, chainId, nonce, message, signature } = req.body ?? {}

  if (!address || !nonce || !message || !signature) {
    return fail(res, 400, 'Missing signature details')
  }
  if (!message.includes(nonce)) {
    return fail(res, 400, 'The signed message does not contain the challenge')
  }
  if (!repo.consumeNonce(req.userId, nonce)) {
    return fail(res, 400, 'That challenge has expired. Try linking again.')
  }

  let valid = false
  try {
    valid = await verifyMessage({ address, message, signature })
  } catch {
    valid = false
  }
  if (!valid) return fail(res, 400, 'That signature does not match the address')

  const claimedBy = repo.addressClaimedBy(address)
  if (claimedBy && claimedBy !== req.userId) {
    return fail(res, 409, 'That address is already linked to another account')
  }

  repo.linkWallet(req.userId, getAddress(address), Number(chainId) || null)
  res.json({ user: repo.getUserById(req.userId, req.userId) })
})

app.delete('/api/wallet/link', requireAuth, (req, res) => {
  repo.unlinkWallet(req.userId)
  res.json({ user: repo.getUserById(req.userId, req.userId) })
})

/* -------------------------------- People -------------------------------- */

app.get('/api/users', (req, res) => {
  res.json({ users: repo.listUsers({ q: String(req.query.q ?? ''), viewerId: req.userId }) })
})

app.get('/api/users/:handle', (req, res) => {
  const user = repo.getUserByHandle(req.params.handle, req.userId)
  if (!user) return fail(res, 404, 'No such account')
  res.json({
    user,
    posts: repo.listPosts({ viewerId: req.userId, authorId: user.id }),
  })
})

app.post('/api/users/:id/follow', requireAuth, (req, res) => {
  const target = repo.getUserById(req.params.id, req.userId)
  if (!target) return fail(res, 404, 'No such account')

  if (req.body?.follow === false) {
    repo.unfollow(req.userId, target.id)
  } else if (repo.follow(req.userId, target.id)) {
    const note = repo.addNotification({
      userId: target.id,
      kind: 'follow',
      actorId: req.userId,
    })
    if (note) push(target.id, { type: 'notification', notification: note })
  }
  res.json({ user: repo.getUserById(target.id, req.userId) })
})

/* --------------------------------- Posts -------------------------------- */

app.get('/api/posts', (req, res) => {
  const scope = req.query.scope === 'following' ? 'following' : 'for-you'
  res.json({ posts: repo.listPosts({ viewerId: req.userId, scope }) })
})

app.post('/api/posts', requireAuth, (req, res) => {
  const draft = req.body ?? {}
  if (!draft.text?.trim() && !draft.media && !draft.poll) {
    return fail(res, 400, 'Write something first')
  }
  const post = repo.createPost(req.userId, draft)
  broadcast({ type: 'post', post }, req.userId)
  res.status(201).json({ post })
})

app.get('/api/posts/:id', (req, res) => {
  const post = repo.getPost(req.params.id, req.userId)
  if (!post) return fail(res, 404, 'Post not found')
  res.json({ post, comments: repo.listComments(post.id, req.userId) })
})

app.delete('/api/posts/:id', requireAuth, (req, res) => {
  if (!repo.deletePost(req.params.id, req.userId)) {
    return fail(res, 404, 'Post not found, or not yours to delete')
  }
  res.json({ ok: true })
})

/** like | repost | bookmark | collect — one endpoint, one shape. */
app.post('/api/posts/:id/react', requireAuth, (req, res) => {
  const post = repo.getPost(req.params.id, req.userId)
  if (!post) return fail(res, 404, 'Post not found')

  const { kind } = req.body ?? {}
  const on = req.body?.on !== false
  if (!repo.setReaction(post.id, req.userId, kind, on)) {
    return fail(res, 400, 'Unknown reaction')
  }

  // Bookmarks are private, so they never notify the author.
  if (on && kind !== 'bookmark' && post.authorId !== req.userId) {
    const note = repo.addNotification({
      userId: post.authorId,
      kind: kind === 'collect' ? 'collect' : kind,
      actorId: req.userId,
      postId: post.id,
    })
    if (note) push(post.authorId, { type: 'notification', notification: note })
  }
  res.json({ post: repo.getPost(post.id, req.userId) })
})

app.get('/api/saved', requireAuth, (req, res) => {
  res.json({
    bookmarks: repo.listReactedPosts(req.userId, 'bookmark'),
    collected: repo.listReactedPosts(req.userId, 'collect'),
  })
})

/**
 * Records that a tip happened. The value transfer itself is settled by the
 * wallet layer before this is called; `settlement` says which — `demo` unless
 * a real chain provider is registered. This endpoint never claims otherwise.
 */
app.post('/api/tips', requireAuth, (req, res) => {
  const { toUserId, postId, amount, asset, settlement } = req.body ?? {}
  const recipient = repo.getUserById(toUserId, req.userId)
  if (!recipient) return fail(res, 404, 'No such account')
  if (recipient.id === req.userId) return fail(res, 400, 'You cannot tip yourself')
  if (!(amount > 0)) return fail(res, 400, 'Amount must be greater than zero')

  repo.recordTip({
    postId: postId ?? null,
    fromUser: req.userId,
    toUser: recipient.id,
    amount,
    asset: asset ?? 'USDC',
    settlement: settlement === 'onchain' ? 'onchain' : 'demo',
  })

  const note = repo.addNotification({
    userId: recipient.id,
    kind: 'tip',
    actorId: req.userId,
    postId: postId ?? null,
    text: `${amount} ${asset ?? 'USDC'}`,
  })
  if (note) push(recipient.id, { type: 'notification', notification: note })

  res.status(201).json({ post: postId ? repo.getPost(postId, req.userId) : null })
})

app.get('/api/posts/:id/comments', (req, res) => {
  res.json({ comments: repo.listComments(req.params.id, req.userId) })
})

app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const text = (req.body?.text ?? '').trim()
  if (!text) return fail(res, 400, 'Write a comment first')

  const post = repo.getPost(req.params.id, req.userId)
  if (!post) return fail(res, 404, 'Post not found')

  const comment = repo.addComment(post.id, req.userId, text)
  const note = repo.addNotification({
    userId: post.authorId,
    kind: 'comment',
    actorId: req.userId,
    postId: post.id,
  })
  if (note) push(post.authorId, { type: 'notification', notification: note })

  res.status(201).json({ comment, post: repo.getPost(post.id, req.userId) })
})

/* ------------------------------ Conversations ---------------------------- */

app.post('/api/comments/:id/like', requireAuth, (req, res) => {
  if (!repo.setCommentLike(req.params.id, req.userId, req.body?.liked !== false)) {
    return fail(res, 404, 'Comment not found')
  }
  res.json({ ok: true })
})

/* ------------------------------ Conversations ---------------------------- */

app.get('/api/conversations', requireAuth, (req, res) => {
  res.json({ conversations: repo.listConversations(req.userId) })
})

app.post('/api/conversations', requireAuth, (req, res) => {
  const other = repo.getUserById(req.body?.userId, req.userId)
  if (!other) return fail(res, 404, 'No such account')
  if (other.id === req.userId) return fail(res, 400, 'You cannot message yourself')

  const id = repo.ensureConversation(req.userId, other.id)
  res.json({ conversationId: id, conversations: repo.listConversations(req.userId) })
})

app.get('/api/conversations/:id/messages', requireAuth, (req, res) => {
  if (!repo.isMember(req.params.id, req.userId)) return fail(res, 403, 'Not your conversation')
  repo.markRead(req.params.id, req.userId)
  res.json({ messages: repo.listMessages(req.params.id) })
})

app.post('/api/conversations/:id/messages', requireAuth, (req, res) => {
  if (!repo.isMember(req.params.id, req.userId)) return fail(res, 403, 'Not your conversation')

  const text = (req.body?.text ?? '').trim()
  const attachment = req.body?.attachment
  if (!text && !attachment) return fail(res, 400, 'Write a message first')

  const message = repo.addMessage(req.params.id, req.userId, text, attachment)

  // Deliver to everyone in the thread, including other tabs of the sender.
  for (const memberId of repo.conversationMembers(req.params.id)) {
    push(memberId, { type: 'message', message })
  }
  res.status(201).json({ message })
})

app.post('/api/conversations/:id/read', requireAuth, (req, res) => {
  if (!repo.isMember(req.params.id, req.userId)) return fail(res, 403, 'Not your conversation')
  repo.markRead(req.params.id, req.userId)
  res.json({ ok: true })
})

/* ----------------------------- Notifications ----------------------------- */

app.get('/api/notifications', requireAuth, (req, res) => {
  res.json({ notifications: repo.listNotifications(req.userId) })
})

app.post('/api/notifications/read', requireAuth, (req, res) => {
  repo.markNotificationsRead(req.userId, req.body?.id)
  res.json({ ok: true })
})

/* ------------------------------- Realtime -------------------------------- */

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

/** userId → set of live sockets. One person may have several tabs or devices. */
const sockets = new Map()

function push(userId, payload) {
  const set = sockets.get(userId)
  if (!set) return
  const data = JSON.stringify(payload)
  for (const socket of set) {
    if (socket.readyState === socket.OPEN) socket.send(data)
  }
}

function broadcast(payload, exceptUserId) {
  for (const [userId] of sockets) {
    if (userId !== exceptUserId) push(userId, payload)
  }
}

function presence() {
  broadcast({ type: 'presence', online: [...sockets.keys()] })
}

wss.on('connection', (socket, req) => {
  // The token arrives as a query parameter — browsers cannot set headers on a
  // WebSocket handshake. It is validated exactly like a REST request.
  const url = new URL(req.url ?? '/ws', 'http://localhost')
  const userId = userIdForToken(url.searchParams.get('token'))

  if (!userId) {
    socket.close(4001, 'Unauthorised')
    return
  }

  if (!sockets.has(userId)) sockets.set(userId, new Set())
  sockets.get(userId).add(socket)
  repo.touchLastSeen(userId)
  presence()

  socket.send(JSON.stringify({ type: 'ready', online: [...sockets.keys()] }))

  socket.on('message', (raw) => {
    let payload
    try {
      payload = JSON.parse(raw.toString())
    } catch {
      return
    }
    // Typing indicators are the only client-originated event, and they are
    // relayed rather than stored.
    if (payload?.type === 'typing' && payload.conversationId) {
      if (!repo.isMember(payload.conversationId, userId)) return
      for (const memberId of repo.conversationMembers(payload.conversationId)) {
        if (memberId !== userId) {
          push(memberId, {
            type: 'typing',
            conversationId: payload.conversationId,
            userId,
          })
        }
      }
    }
  })

  socket.on('close', () => {
    const set = sockets.get(userId)
    set?.delete(socket)
    if (set && set.size === 0) sockets.delete(userId)
    repo.touchLastSeen(userId)
    presence()
  })
})

/* -------------------------------- Startup -------------------------------- */

const result = seedIfEmpty()
server.listen(PORT, HOST, () => {
  if (result.seeded) {
    console.log(`[mesh] seeded ${result.users} demo accounts and ${result.posts} posts`)
  }
  console.log(`[mesh] api listening on http://${HOST}:${PORT}`)
})
