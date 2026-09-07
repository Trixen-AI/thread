import type {
  Collectible,
  TokenBalance,
  TokenSymbol,
  TransferReceipt,
  WalletAccount,
} from '@/types'

/**
 * The seam between MESH and a blockchain.
 *
 * Everything the product needs from a chain is expressed here. Swapping in a
 * real EVM provider (injected wallet, WalletConnect, an embedded signer) means
 * writing one more implementation of this interface and registering it — no UI
 * or feature code changes.
 */
export interface OwnershipProof {
  address: string
  statement: string
  issuedAt: string
  /** A real provider returns the signature; the demo provider returns null. */
  signature: string | null
  verified: boolean
}

export interface TransferRequest {
  to: string
  /** Display name for the recipient, e.g. "@nadia" or a community name. */
  toLabel: string
  amount: number
  asset: TokenSymbol
  memo?: string
}

export interface ChainProvider {
  /** Stable identifier, e.g. `demo`, `injected`, `walletconnect`. */
  readonly id: string
  readonly label: string
  /**
   * True when this provider does not touch a blockchain. The UI reads this to
   * label demo behaviour honestly; it must never be hard-coded to false.
   */
  readonly isDemo: boolean

  connect(): Promise<WalletAccount[]>
  disconnect(): Promise<void>
  getAccounts(): Promise<WalletAccount[]>
  getBalances(address: string): Promise<TokenBalance[]>
  getCollectibles(address: string): Promise<Collectible[]>
  /** Prove control of an address. Real providers sign; the demo provider cannot. */
  proveOwnership(address: string, statement: string): Promise<OwnershipProof>
  transfer(request: TransferRequest): Promise<TransferReceipt>
  /** Transfers made in this session, newest first. */
  getHistory(): Promise<TransferReceipt[]>
}

/* ------------------------------ Registry ------------------------------ */

let active: ChainProvider | null = null

export const providerRegistry = {
  set(provider: ChainProvider) {
    active = provider
  },
  get(): ChainProvider {
    if (!active) {
      throw new Error(
        'No ChainProvider registered. Call providerRegistry.set() during app bootstrap.',
      )
    }
    return active
  },
  /** True once a provider that actually talks to a chain has been registered. */
  isLive(): boolean {
    return !!active && !active.isDemo
  },
}
