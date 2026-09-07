/**
 * A read-only relay to Robinhood Chain's own RPC.
 *
 * The launchpad reads pons contracts straight from the chain, which is what
 * lets anyone browse launches with no wallet connected. That normally happens
 * from the browser, directly against the RPC the chain publishes.
 *
 * The gateway in front of that RPC intermittently answers with two
 * `Access-Control-Allow-Origin` headers, which every browser rejects — so a
 * read that would have succeeded fails for reasons that have nothing to do with
 * the chain. This relay is the fallback: same RPC, same request, from a server
 * where CORS does not apply. The client tries the RPC directly first and only
 * comes here when the browser refuses the response.
 *
 * It is deliberately not a general proxy:
 *
 *   - only the read methods the launchpad actually calls are forwarded, so this
 *     can never relay a signed transaction or an account-management call
 *   - the upstream URL is fixed here, never taken from the request
 *   - no credential is added, because the RPC needs none
 *
 * Writes never come through here. Every pons transaction is signed and
 * broadcast by the user's own wallet.
 */

const UPSTREAM = 'https://rpc.mainnet.chain.robinhood.com'

/** The read methods the launchpad uses, and nothing else. */
const ALLOWED = new Set([
  'eth_call',
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBalance',
  'eth_getCode',
  'eth_getLogs',
  'eth_estimateGas',
  'net_version',
])

const MAX_BATCH = 64

/** True when the body is one allowed call, or a batch of them. */
function permitted(body) {
  const calls = Array.isArray(body) ? body : [body]
  if (!calls.length || calls.length > MAX_BATCH) return false
  return calls.every((c) => c && typeof c.method === 'string' && ALLOWED.has(c.method))
}

export function rpcRelay(req, res) {
  if (!permitted(req.body)) {
    return res.status(400).json({ error: 'Only read-only chain methods are relayed here.' })
  }

  const timeout = AbortSignal.timeout(20_000)
  fetch(UPSTREAM, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body),
    signal: timeout,
  })
    .then(async (upstream) => {
      const text = await upstream.text()
      // Pass the payload through untouched — a JSON-RPC error is a valid answer
      // and the client knows how to read it.
      res.status(upstream.status).type('application/json').send(text)
    })
    .catch((error) => {
      res.status(502).json({ error: `Could not reach the chain RPC: ${error.message}` })
    })
}
