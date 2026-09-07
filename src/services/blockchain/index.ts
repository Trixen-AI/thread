/**
 * Blockchain layer — public surface.
 *
 * Features import these services; they never import a provider directly and
 * never construct chain calls themselves.
 */

import type {
  AccessCondition,
  AccessRule,
  Collectible,
  Community,
  Membership,
  TokenBalance,
  TokenSymbol,
  TransferReceipt,
  User,
  WalletAccount,
} from '@/types'
import { uid } from '@/lib/utils'
import { providerRegistry } from './provider'
import type { ChainProvider, OwnershipProof, TransferRequest } from './provider'
import { demoProvider } from './demoProvider'

import { evmProvider } from './evmProvider'
import { getWallets, type WalletOption } from './wallets'

export { providerRegistry } from './provider'
export type { ChainProvider, OwnershipProof, TransferRequest } from './provider'
export { demoProvider } from './demoProvider'
export { evmProvider } from './evmProvider'
export * from './chains'
export * from './wallets'
export * from './appkit'

/**
 * Bootstrap. Registers the stand-in provider so every service has something to
 * talk to before a wallet is connected; connecting one swaps it underneath them
 * all, and nothing else in the app changes.
 *
 * There is no wallet discovery here any more. MESH used to listen for EIP-6963
 * announcements to build its own picker; AppKit does that itself, and better.
 */
export function initBlockchain(provider: ChainProvider = demoProvider) {
  providerRegistry.set(provider)
}

/** Switch to a real browser wallet. Pass nothing to use the first one found. */
export function useRealWallet(wallet?: WalletOption) {
  const chosen = wallet ?? getWallets()[0]
  if (!chosen) throw new Error('No browser wallet found. Install one and reload.')
  evmProvider.select(chosen)
  providerRegistry.set(evmProvider)
  return evmProvider
}

export function useDemoWallet() {
  providerRegistry.set(demoProvider)
}

const provider = () => providerRegistry.get()

/* ----------------------------- WalletService ----------------------------- */

export const WalletService = {
  isDemo: () => provider().isDemo,
  providerLabel: () => provider().label,

  async connect(): Promise<WalletAccount[]> {
    return provider().connect()
  },
  async disconnect(): Promise<void> {
    return provider().disconnect()
  },
  async accounts(): Promise<WalletAccount[]> {
    return provider().getAccounts()
  },
  async balances(address: string): Promise<TokenBalance[]> {
    return provider().getBalances(address)
  },
  async history(): Promise<TransferReceipt[]> {
    return provider().getHistory()
  },
  /**
   * Total portfolio value in USD, or `null` when no price feed is configured.
   * Callers must handle null rather than defaulting to zero — a wallet holding
   * real funds must never render as "$0.00" because prices are unavailable.
   */
  totalValue(balances: TokenBalance[]): number | null {
    const priced = balances.filter((b) => b.usdPrice !== null)
    if (!priced.length) return null
    return priced.reduce((sum, b) => sum + b.amount * (b.usdPrice ?? 0), 0)
  },

  /** Weighted 24h change across the portfolio, or `null` without prices. */
  totalChange(balances: TokenBalance[]): number | null {
    const total = this.totalValue(balances)
    if (total === null || total === 0) return null
    return balances.reduce(
      (acc, b) => acc + (b.amount * (b.usdPrice ?? 0) * (b.change24h ?? 0)) / total,
      0,
    )
  },
}

/* ---------------------------- IdentityService ---------------------------- */

export interface MeshIdentity {
  handle: string
  displayName: string
  address?: string
  /** Set once a proof has been produced AND verified by a real provider. */
  ownershipVerified: boolean
  linkedAt?: string
}

export const IdentityService = {
  forUser(user: User, account: WalletAccount | null, verified: boolean): MeshIdentity {
    return {
      handle: user.handle,
      displayName: user.name,
      address: account?.address,
      ownershipVerified: verified,
      linkedAt: account ? user.joinedAt : undefined,
    }
  },

  /**
   * Ask the provider to prove the account is controlled by this user.
   * The demo provider cannot sign, so `verified` comes back false — the UI
   * reports that plainly rather than showing a green check.
   */
  async proveOwnership(address: string, handle: string): Promise<OwnershipProof> {
    return provider().proveOwnership(
      address,
      `Link this wallet to @${handle} on MESH.\nIssued: ${new Date().toISOString()}`,
    )
  },
}

/* --------------------------- ReputationService --------------------------- */

export interface ReputationBreakdown {
  total: number
  /** Whether the total was computed onchain or read from seeded profile data. */
  source: 'demo' | 'onchain'
  factors: Array<{ label: string; points: number; hint: string }>
}

export const ReputationService = {
  /**
   * Reputation is presented as a single number but is a sum of legible parts —
   * a score you cannot explain to the person it describes is not reputation.
   *
   * The weights below are demo values. A live implementation would read
   * attestations and community contributions from the chain.
   */
  breakdown(
    user: User,
    holdings: { communities: number; collectibles: number },
  ): ReputationBreakdown {
    const accountYears = Math.max(
      0,
      (Date.now() - new Date(user.joinedAt).getTime()) / (365 * 24 * 3600 * 1000),
    )
    const factors = [
      {
        label: 'Account history',
        points: Math.round(accountYears * 60),
        hint: `${accountYears.toFixed(1)} years on MESH`,
      },
      {
        label: 'Community contribution',
        points: holdings.communities * 45,
        hint: `${holdings.communities} active ${holdings.communities === 1 ? 'community' : 'communities'}`,
      },
      {
        label: 'Verified ownership',
        points: holdings.collectibles * 30,
        hint: `${holdings.collectibles} collectibles held`,
      },
      {
        label: 'Creator activity',
        points: Math.min(200, user.postCount * 12),
        hint: `${user.postCount} ${user.postCount === 1 ? 'post' : 'posts'} published`,
      },
      {
        label: 'Endorsements',
        points: Math.round(Math.min(user.followers, 20000) / 60),
        hint: 'From accounts with reputation above 500',
      },
    ]
    const computed = factors.reduce((s, f) => s + f.points, 0)
    return {
      // Prefer the stored score so the number stays stable across the demo.
      total: user.reputation || computed,
      source: providerRegistry.isLive() ? 'onchain' : 'demo',
      factors,
    }
  },

  tier(score: number): { label: string; hint: string } {
    if (score >= 1500) return { label: 'Established', hint: 'Top 1% of MESH' }
    if (score >= 800) return { label: 'Trusted', hint: 'Top 4% of MESH' }
    if (score >= 300) return { label: 'Contributor', hint: 'Active and vouched for' }
    return { label: 'New', hint: 'Building a track record' }
  },
}

/* --------------------------- MembershipService --------------------------- */

export interface AccessCheck {
  granted: boolean
  /** Every condition with a pass/fail, so the UI can explain the gate. */
  conditions: Array<{
    condition: AccessCondition
    met: boolean
    label: string
    detail: string
  }>
  /** The action that would unlock access, when there is one. */
  remedy?: 'connect-wallet' | 'acquire-token' | 'acquire-nft' | 'build-reputation' | 'purchase' | 'request-invite'
}

export interface AccessContext {
  connected: boolean
  balances: TokenBalance[]
  collectibles: Collectible[]
  reputation: number
}

function describe(condition: AccessCondition): { label: string; detail: string } {
  switch (condition.kind) {
    case 'free':
      return { label: 'Open to everyone', detail: 'No requirements to join' }
    case 'token':
      return {
        label: `Hold ≥ ${condition.amount.toLocaleString()} $${condition.symbol}`,
        detail: `Token requirement in $${condition.symbol}`,
      }
    case 'nft':
      return {
        label: `Own ${condition.amount > 1 ? `${condition.amount}× ` : ''}${condition.collection}`,
        detail: 'Collectible requirement',
      }
    case 'reputation':
      return {
        label: `Reputation ≥ ${condition.min}`,
        detail: 'Earned through contribution on MESH',
      }
    case 'paid':
      return {
        label: `${condition.price} ${condition.asset} to join`,
        detail: 'One-time membership payment',
      }
    case 'invite':
      return { label: 'Invite only', detail: 'A current member has to invite you' }
  }
}

const remedyFor = (kind: AccessCondition['kind']): AccessCheck['remedy'] =>
  ({
    free: undefined,
    token: 'acquire-token',
    nft: 'acquire-nft',
    reputation: 'build-reputation',
    paid: 'purchase',
    invite: 'request-invite',
  })[kind] as AccessCheck['remedy']

export const MembershipService = {
  /** Conditions are OR'd: satisfying any one grants access. */
  check(rule: AccessRule, ctx: AccessContext): AccessCheck {
    const conditions = rule.anyOf.map((condition) => {
      const { label, detail } = describe(condition)
      let met = false
      switch (condition.kind) {
        case 'free':
          met = true
          break
        case 'token': {
          const bal = ctx.balances.find((b) => b.symbol === condition.symbol)
          met = ctx.connected && !!bal && bal.amount >= condition.amount
          break
        }
        case 'nft': {
          const owned = ctx.collectibles.filter(
            (c) => c.collectionId === condition.collectionId,
          ).length
          met = ctx.connected && owned >= condition.amount
          break
        }
        case 'reputation':
          met = ctx.reputation >= condition.min
          break
        case 'paid':
        case 'invite':
          met = false
          break
      }
      return { condition, met, label, detail }
    })

    const granted = conditions.some((c) => c.met)
    const firstUnmet = conditions.find((c) => !c.met)
    return {
      granted,
      conditions,
      remedy: granted ? undefined : firstUnmet && remedyFor(firstUnmet.condition.kind),
    }
  },

  /**
   * Issue the community's membership credential.
   *
   * Custody is `mesh-account` while the demo provider is active — a credential
   * only lives in a wallet once a contract has actually minted it.
   */
  issueCredential(community: Community, memberNumber: number): Membership {
    return {
      id: uid('mem'),
      communityId: community.id,
      memberNumber,
      status: 'active',
      issuedAt: new Date().toISOString(),
      custody: providerRegistry.isLive() ? 'wallet' : 'mesh-account',
    }
  },
}

/* ---------------------------- PaymentService ---------------------------- */

export type PaymentPurpose = 'tip' | 'collect' | 'membership' | 'purchase' | 'transfer'

export interface PaymentRequest extends TransferRequest {
  purpose: PaymentPurpose
}

export const PaymentService = {
  async pay(request: PaymentRequest): Promise<TransferReceipt> {
    const { purpose, ...transfer } = request
    return provider().transfer({
      ...transfer,
      memo: transfer.memo ?? defaultMemo(purpose),
    })
  },

  /**
   * How a settled payment should be described to the user. Demo settlements are
   * labelled as such; only a real onchain settlement is called confirmed.
   */
  describeSettlement(receipt: TransferReceipt): { title: string; detail: string; demo: boolean } {
    if (receipt.settlement.kind === 'demo') {
      return {
        title: 'Demo payment recorded',
        detail:
          'This ran against the local demo wallet. Nothing was broadcast to a blockchain and no transaction exists.',
        demo: true,
      }
    }
    return {
      title: 'Confirmed onchain',
      detail: `Transaction ${receipt.settlement.hash.slice(0, 10)}… on chain ${receipt.settlement.chainId}.`,
      demo: false,
    }
  },
}

const defaultMemo = (purpose: PaymentPurpose) =>
  ({
    tip: 'Tip',
    collect: 'Collect post',
    membership: 'Community membership',
    purchase: 'Marketplace purchase',
    transfer: 'Transfer',
  })[purpose]

/* --------------------------- CollectibleService --------------------------- */

export const CollectibleService = {
  async owned(address: string): Promise<Collectible[]> {
    return provider().getCollectibles(address)
  },

  /**
   * Price of collecting a post. Creators keep 95%; the rest covers the
   * protocol fee. Split is shown in the collect sheet.
   */
  quote(price: number, asset: TokenSymbol) {
    const fee = Number((price * 0.05).toFixed(4))
    return { price, asset, fee, toCreator: Number((price - fee).toFixed(4)) }
  },
}
