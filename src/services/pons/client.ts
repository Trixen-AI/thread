import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { evmProvider, robinhoodRpcUrl } from '@/services/blockchain'
import { PONS_CHAIN, PONS_CHAIN_ID } from './config'

/**
 * Talking to pons.
 *
 * Two clients, for two different jobs.
 *
 * Reading is public. Anyone should be able to browse launches, watch a curve
 * fill and read a creator's terms without connecting anything, so reads go over
 * Robinhood Chain's own published RPC and work with no wallet at all. This adds
 * no credential to MESH: the URL is the one the chain publishes, already
 * shipped in the chain registry, and it is only ever read from.
 *
 * Writing is the user's. Every transaction is signed by the wallet the user
 * chose, on the chain they confirmed — MESH never holds a key and never
 * broadcasts on someone's behalf.
 */

/**
 * Read-only, always available, always on chain 4663.
 *
 * Straight to the RPC Robinhood Chain publishes — the browser talks to the
 * chain and nothing of MESH's sits in the path, so the launchpad keeps working
 * whatever the MESH server is doing, and there is no key to leak or rotate.
 *
 * Reads are folded through Multicall3 rather than JSON-RPC batching. Checking
 * the quote-asset registry alone is over two hundred `eth_call`s, and a batch
 * that size is rejected by the gateway in front of this RPC; through Multicall3
 * the same work is a single call. The contract is the canonical deployment and
 * was confirmed to hold bytecode on this chain — see the chain registry.
 *
 * A failed read is retried a few times and then reported as itself. There was
 * briefly a server-side relay behind this as a fallback, for the occasions when
 * the RPC answers with a malformed CORS header; it was removed because a second
 * path that can fail in its own way turns one rare hiccup into two failure
 * modes, and the one it produced — a 404 from the front end's own host — said
 * nothing true about what went wrong.
 */
export const ponsClient: PublicClient = createPublicClient({
  chain: PONS_CHAIN,
  transport: http(robinhoodRpcUrl(), { retryCount: 3, retryDelay: 300 }),
  batch: { multicall: { wait: 24 } },
})

export class PonsWalletError extends Error {
  /** What the UI should offer to fix it. */
  readonly remedy: 'connect' | 'switch-network'

  constructor(message: string, remedy: PonsWalletError['remedy']) {
    super(message)
    this.name = 'PonsWalletError'
    this.remedy = remedy
  }
}

export interface PonsSigner {
  walletClient: WalletClient
  account: Address
}

/**
 * The signer for a pons transaction, or a refusal that says what to do.
 *
 * pons is a set of contracts on one chain. The demo provider holds no keys and
 * reaches no chain, so it cannot launch a token or buy one — and saying that
 * plainly is better than a simulated launch that produces a token address
 * belonging to nothing.
 */
export async function requirePonsSigner(): Promise<PonsSigner> {
  const account = evmProvider.account
  if (!account) {
    throw new PonsWalletError(
      'Connect a browser wallet to trade on pons. The demo wallet holds no keys, so it cannot sign a transaction.',
      'connect',
    )
  }

  // Puts the wallet on Robinhood Chain, offering to add it if the wallet has
  // never heard of it. A wrong-chain transaction is the failure mode this
  // exists to prevent.
  await evmProvider.ensureChain(PONS_CHAIN_ID)

  const walletClient = evmProvider.signer()
  if (!walletClient) {
    throw new PonsWalletError('The wallet did not return a signer. Reconnect and try again.', 'connect')
  }
  if (evmProvider.currentChainId !== PONS_CHAIN_ID) {
    throw new PonsWalletError(
      `pons v2 is on ${PONS_CHAIN.name} (chain ${PONS_CHAIN_ID}). Switch your wallet to it before continuing.`,
      'switch-network',
    )
  }

  return { walletClient, account }
}

/** True when a real wallet is connected and already on Robinhood Chain. */
export const onPonsChain = () =>
  evmProvider.connected && evmProvider.currentChainId === PONS_CHAIN_ID
