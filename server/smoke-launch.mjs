/**
 * End-to-end check of the launch thread: a post can carry a pons v2 token, it
 * survives the round trip, everyone else can see it, and a made-up attachment
 * is dropped rather than stored.
 *
 *   node server/smoke-launch.mjs
 *
 * Expects the API to be running. Exits non-zero on the first failed check.
 */

const BASE = process.env.MESH_API ?? 'http://localhost:8787'

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
const creator = { handle: `creator${unique}`, name: 'Cass Ito', password: 'correct horse 1' }
const reader = { handle: `reader${unique}`, name: 'Rin Alvarez', password: 'another good one' }

const c = await api('/api/auth/register', { method: 'POST', body: creator })
check('creator registers', c.status === 201 && !!c.token, c.error)
const r = await api('/api/auth/register', { method: 'POST', body: reader })
check('reader registers', r.status === 201 && !!r.token, r.error)

/* ---------------------------- The launch thread ---------------------------- */

// The shape the launchpad posts after a launch confirms onchain.
const token = {
  chainId: 4663,
  address: '0xCC649dE3a0fE49fA7818601B72dbde44FbDbf86A',
  curve: '0xCcB75fc4C33F8e2784b5d914a7236855b54d154D',
  name: 'Example Coin',
  symbol: 'EXMPL',
  quoteSymbol: 'ETH',
  logo: 'ipfs://bafybeieytoic4amkvtwibdv3uf2ytbprz6dbxyn3qdh2k77kshrzaiwywu',
  launchTx: '0x' + 'ab'.repeat(32),
}

const posted = await api('/api/posts', {
  token: c.token,
  method: 'POST',
  body: { text: 'Just launched $EXMPL on pons v2.', audience: 'everyone', token },
})
check('a launch thread is published', posted.status === 201, posted.error)
check(
  'the post carries the token',
  posted.post?.token?.address === token.address && posted.post?.token?.symbol === 'EXMPL',
  JSON.stringify(posted.post?.token ?? null),
)
check('it carries the curve, so the thread can route to it', posted.post?.token?.curve === token.curve)
check('and the launch transaction', posted.post?.token?.launchTx === token.launchTx)

const fetched = await api(`/api/posts/${posted.post.id}`, { token: r.token })
check('the attachment survives the round trip', fetched.post?.token?.address === token.address)

const feed = await api('/api/posts?scope=for-you', { token: r.token })
const inFeed = feed.posts?.find((p) => p.id === posted.post.id)
check('another account sees the token in the feed', inFeed?.token?.symbol === 'EXMPL')

/* ------------------------------ Bad input ------------------------------ */

const junk = await api('/api/posts', {
  token: c.token,
  method: 'POST',
  body: {
    text: 'This one has a bogus attachment.',
    audience: 'everyone',
    token: { chainId: 'not-a-number', address: 'nope', curve: '0x123', name: 'X', symbol: 'X' },
  },
})
check('a post with an unusable attachment still publishes', junk.status === 201, junk.error)
check('but the attachment is dropped rather than stored', junk.post?.token === undefined, JSON.stringify(junk.post?.token ?? null))

const noToken = await api('/api/posts', {
  token: c.token,
  method: 'POST',
  body: { text: 'An ordinary post.', audience: 'everyone' },
})
check('an ordinary post is unaffected', noToken.status === 201 && noToken.post?.token === undefined)

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
