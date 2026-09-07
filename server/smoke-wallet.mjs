/**
 * Checks the wallet-link challenge–response.
 *
 * Uses a throwaway private key to play the part of a browser wallet, so the
 * signature path is exercised for real: a valid signature links, a signature
 * from a different key is rejected, a replayed nonce is rejected, and an
 * address already claimed by someone else is refused.
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

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
    json = { error: text.slice(0, 140) }
  }
  return { status: res.status, ...json }
}

const tag = Date.now().toString(36).slice(-6)
const signUp = (name) =>
  api('/api/auth/register', {
    method: 'POST',
    body: { handle: `${name}${tag}`, name, password: 'a good long password' },
  })

const alice = await signUp('walletalice')
const bob = await signUp('walletbob')
check('two accounts created', !!alice.token && !!bob.token)

const account = privateKeyToAccount(generatePrivateKey())
const impostor = privateKeyToAccount(generatePrivateKey())

/* ------------------------- A signature that matches ------------------------ */

const challenge = await api('/api/wallet/nonce', { method: 'POST', token: alice.token })
check('server issues a nonce', !!challenge.nonce && challenge.message.includes(challenge.nonce))

const wrongSigner = await api('/api/wallet/link', {
  method: 'POST',
  token: alice.token,
  body: {
    address: account.address,
    chainId: 1,
    nonce: challenge.nonce,
    message: challenge.message,
    signature: await impostor.signMessage({ message: challenge.message }),
  },
})
check(
  'a signature from another key is rejected',
  wrongSigner.status === 400,
  `status ${wrongSigner.status}`,
)

// That attempt consumed the nonce, so a fresh one is required — as intended.
const second = await api('/api/wallet/nonce', { method: 'POST', token: alice.token })
const linked = await api('/api/wallet/link', {
  method: 'POST',
  token: alice.token,
  body: {
    address: account.address,
    chainId: 1,
    nonce: second.nonce,
    message: second.message,
    signature: await account.signMessage({ message: second.message }),
  },
})
check(
  'a valid signature links the address',
  linked.status === 200 && linked.user?.walletAddress?.toLowerCase() === account.address.toLowerCase(),
  linked.error,
)

/* ------------------------------- Replay ---------------------------------- */

const replay = await api('/api/wallet/link', {
  method: 'POST',
  token: alice.token,
  body: {
    address: account.address,
    chainId: 1,
    nonce: second.nonce,
    message: second.message,
    signature: await account.signMessage({ message: second.message }),
  },
})
check('the same nonce cannot be replayed', replay.status === 400, `status ${replay.status}`)

/* --------------------------- Someone else's address ------------------------ */

const bobChallenge = await api('/api/wallet/nonce', { method: 'POST', token: bob.token })
const steal = await api('/api/wallet/link', {
  method: 'POST',
  token: bob.token,
  body: {
    address: account.address,
    chainId: 1,
    nonce: bobChallenge.nonce,
    message: bobChallenge.message,
    signature: await account.signMessage({ message: bobChallenge.message }),
  },
})
check(
  'an address already linked elsewhere is refused',
  steal.status === 409,
  `status ${steal.status}`,
)

/* ------------------------------- Visibility ------------------------------- */

const seen = await api(`/api/users/walletalice${tag}`, { token: bob.token })
check(
  'the linked address is visible to others, so they can tip it',
  seen.user?.walletAddress?.toLowerCase() === account.address.toLowerCase(),
)

const unlinked = await api('/api/wallet/link', { method: 'DELETE', token: alice.token })
check('unlinking clears the address', !unlinked.user?.walletAddress)

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
