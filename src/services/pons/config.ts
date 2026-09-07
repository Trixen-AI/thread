import type { Address } from 'viem'
import { robinhoodChain } from '@/services/blockchain/chains'

/**
 * Where pons v2 lives.
 *
 * One deployment, on Robinhood Chain. A hook binds to one factory permanently,
 * so the launchpad is replaced as a whole set rather than upgraded in place —
 * which is why a token's curve and its token address are always resolved from
 * the factory rather than assumed or cached across deployments.
 *
 * Addresses cross-checked against docs.ponsfamily.com/v2 and confirmed on chain:
 * each one holds bytecode, and the factory answers every read this app makes.
 */

export const PONS_CHAIN = robinhoodChain
export const PONS_CHAIN_ID = robinhoodChain.id // 4663

export const PONS = {
  /** Deploys every launch, holds launch configuration, drives graduation. */
  factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
  /** Singleton Uniswap v4 hook. Accrues post-graduation fees. */
  memeHook: '0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044',
  /** Holds claimable protocol and creator balances, in ETH and ERC-20. */
  feeEscrow: '0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e',
  /** Holds bought-back supply, released linearly over five years. */
  buybackVault: '0x42df2a798f82289E177311362e8f5ccC45c1219c',
  /** Permanently holds each graduated pool position. */
  launchLocker: '0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952',
  /** Optional router: creates a launch and buys into it in one transaction. */
  launchAndBuy: '0xe33E9E479dF8802cb0866d5d05258bEc4cF62948',
  /** Deploys each curve and token at creator-selected CREATE2 addresses. */
  launchDeployer: '0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42',
  graduationExecutor: '0xC7819B64A1dAECD7eC19856d026cb14EfBd89046',
  graduationGuard: '0xf5695117b99B6f6401e67d4195BD653628176C6C',
} as const satisfies Record<string, Address>

/** A native-ETH launch passes the zero address as its quote asset. */
export const NATIVE_QUOTE = '0x0000000000000000000000000000000000000000' as const

/** Basis-point denominator, used by every fee and tax on the protocol. */
export const BPS = 10_000n

/** The contract rejects an exemption list longer than this. */
export const MAX_SNIPE_EXEMPTIONS = 32

/**
 * How long the opening snipe tax takes to decay to zero. Read from the docs
 * rather than the chain, and used only to explain the window in the UI — every
 * number that decides a trade comes from `currentSnipeTaxBps()`.
 */
export const SNIPE_WINDOW_SECONDS = 5

/** Phase, as reported by `getLaunchedToken().phase`. */
export const LAUNCH_PHASE = {
  0: 'trading',
  1: 'swept',
  2: 'graduated',
  3: 'rescued',
} as const

export type LaunchPhase = (typeof LAUNCH_PHASE)[keyof typeof LAUNCH_PHASE]

export const phaseLabel: Record<LaunchPhase, string> = {
  trading: 'On the curve',
  swept: 'Graduating',
  graduated: 'On Uniswap v4',
  rescued: 'Rescued',
}

export const phaseDetail: Record<LaunchPhase, string> = {
  trading: 'Buy and sell against the bonding curve.',
  swept: 'The curve sold out. The pool has not been created yet — anyone can finish it.',
  graduated: 'The curve is closed and liquidity is locked in a Uniswap v4 pool.',
  rescued: 'This launch went through the recovery path rather than the normal one.',
}

/** Block explorer link for an address on Robinhood Chain. */
export const explorerAddress = (address: string) =>
  `${robinhoodChain.blockExplorers.default.url}/address/${address}`

export const explorerTx = (hash: string) =>
  `${robinhoodChain.blockExplorers.default.url}/tx/${hash}`
