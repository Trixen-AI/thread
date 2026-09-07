/**
 * End-to-end check of the API: two people sign up, discover each other,
 * follow, post, react, and exchange a message over the WebSocket.
 *
 *   node server/smoke.mjs
 *
 * Expects the API to be running. Exits non-zero on the first failed check.
 */

const BASE = process.env.MESH_API ?? 'http://localhost:8787'
const WS = BASE.replace(/^http/, 'ws') + '/ws'

let failures = 0
const check = (label, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { error: text.slice(0, 120) }
  }
  return { status: res.status, ...json }
}

const unique = Date.now().toString(36).slice(-6)
const alice = { handle: `alice${unique}`, name: 'Alice Tan', password: 'correct horse 1' }
const bob = { handle: `bob${unique}`, name: 'Bob Rivera', password: 'another good one' }

/* ------------------------------- Accounts ------------------------------- */

const a = await api('/api/auth/register', { method: 'POST', body: alice })
check('alice registers', a.status === 201 && !!a.token, a.error)

const b = await api('/api/auth/register', { method: 'POST', body: bob })
check('bob registers', b.status === 201 && !!b.token, b.error)

const dupe = await api('/api/auth/register', { method: 'POST', body: alice })
check('duplicate handle rejected', dupe.status === 409, `status ${dupe.status}`)

const weak = await api('/api/auth/register', {
  method: 'POST',
  body: { handle: `x${unique}`, name: 'X', password: 'short' },
})
check('weak password rejected', weak.status === 400, `status ${weak.status}`)

const wrong = await api('/api/auth/login', {
  method: 'POST',
  body: { handle: alice.handle, password: 'not the password' },
})
check('wrong password rejected', wrong.status === 401, `status ${wrong.status}`)

const relogin = await api('/api/auth/login', {
  method: 'POST',
  body: { handle: alice.handle, password: alice.password },
})
check('alice can sign back in', relogin.status === 200 && !!relogin.token, relogin.error)

const anon = await api('/api/me')
check('no session is rejected', anon.status === 401)

/* ------------------------------- Discovery ------------------------------- */

const found = await api(`/api/users?q=${bob.name.split(' ')[0]}`, { token: a.token })
const bobRow = found.users?.find((u) => u.handle === bob.handle)
check('alice can find bob in the directory', !!bobRow)

const profile = await api(`/api/users/${bob.handle}`, { token: a.token })
check('alice can open bob’s profile', profile.status === 200 && profile.user.handle === bob.handle)

/* -------------------------------- Follows -------------------------------- */

await api(`/api/users/${b.user.id}/follow`, { method: 'POST', token: a.token })
const afterFollow = await api(`/api/users/${bob.handle}`, { token: a.token })
check(
  'follow registers on both sides',
  afterFollow.user.followedByMe === true && afterFollow.user.followers === 1,
  `followers=${afterFollow.user.followers}`,
)

const bobNotes = await api('/api/notifications', { token: b.token })
check('bob is notified of the follow', bobNotes.notifications?.[0]?.kind === 'follow')

/* --------------------------------- Posts --------------------------------- */

const posted = await api('/api/posts', {
  method: 'POST',
  token: b.token,
  body: { text: 'First post from Bob.', audience: 'everyone' },
})
check('bob publishes a post', posted.status === 201, posted.error)

const feed = await api('/api/posts?scope=following', { token: a.token })
check(
  'the post appears in alice’s following feed',
  feed.posts?.some((p) => p.id === posted.post.id),
)

const liked = await api(`/api/posts/${posted.post.id}/react`, {
  method: 'POST',
  token: a.token,
  body: { kind: 'like' },
})
check('alice likes it', liked.post?.likes === 1 && liked.post?.likedByMe === true)

const bobSees = await api(`/api/posts/${posted.post.id}`, { token: b.token })
check(
  'bob sees the like but not as his own',
  bobSees.post.likes === 1 && bobSees.post.likedByMe === false,
)

const commented = await api(`/api/posts/${posted.post.id}/comments`, {
  method: 'POST',
  token: a.token,
  body: { text: 'Welcome to MESH.' },
})
check('alice comments', commented.status === 201 && commented.post.comments === 1)

/* ------------------------------- Visibility ------------------------------ */

const priv = await api('/api/posts', {
  method: 'POST',
  token: b.token,
  body: { text: 'Only me.', audience: 'private' },
})
const aliceFeed = await api('/api/posts', { token: a.token })
check(
  'a private post is hidden from other accounts',
  !aliceFeed.posts.some((p) => p.id === priv.post.id),
)
const bobFeed = await api('/api/posts', { token: b.token })
check('its author still sees it', bobFeed.posts.some((p) => p.id === priv.post.id))

/* -------------------------------- Messaging ------------------------------ */

const convo = await api('/api/conversations', {
  method: 'POST',
  token: a.token,
  body: { userId: b.user.id },
})
check('alice opens a conversation', !!convo.conversationId, convo.error)

// Bob listens on the socket while Alice sends.
const delivered = await new Promise(async (resolve) => {
  const socket = new (await import('ws')).WebSocket(`${WS}?token=${b.token}`)
  const timer = setTimeout(() => resolve(null), 5000)

  socket.on('message', (raw) => {
    const event = JSON.parse(raw.toString())
    if (event.type === 'message') {
      clearTimeout(timer)
      socket.close()
      resolve(event.message)
    }
  })

  socket.on('open', async () => {
    await api(`/api/conversations/${convo.conversationId}/messages`, {
      method: 'POST',
      token: a.token,
      body: { text: 'Hey Bob — this arrived over the socket.' },
    })
  })
})

check(
  'the message reaches bob in real time',
  delivered?.text === 'Hey Bob — this arrived over the socket.',
  delivered ? undefined : 'timed out',
)

const inbox = await api('/api/conversations', { token: b.token })
check('it shows unread in bob’s inbox', inbox.conversations?.[0]?.unread === 1)

await api(`/api/conversations/${convo.conversationId}/messages`, { token: b.token })
const afterRead = await api('/api/conversations', { token: b.token })
check('opening the thread clears unread', afterRead.conversations?.[0]?.unread === 0)

const outsider = await api('/api/auth/register', {
  method: 'POST',
  body: { handle: `carol${unique}`, name: 'Carol', password: 'yet another one' },
})
const peek = await api(`/api/conversations/${convo.conversationId}/messages`, {
  token: outsider.token,
})
check('a third party cannot read the thread', peek.status === 403, `status ${peek.status}`)

/* --------------------------------- Demo --------------------------------- */

const demoLogin = await api('/api/auth/login', {
  method: 'POST',
  body: { handle: 'mayaokonkwo', password: 'whatever goes here' },
})
check('seeded personas cannot be signed into', demoLogin.status === 401)

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
