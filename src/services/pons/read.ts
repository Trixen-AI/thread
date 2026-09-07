import { erc20Abi, formatUnits, getAddress, parseAbiItem, type Address } from 'viem'
import { curveAbi, factoryAbi, launchTokenAbi } from './abi'
import { ponsClient } from './client'
import { LAUNCH_PHASE, NATIVE_QUOTE, PONS, PONS_CHAIN, type LaunchPhase } from './config'
import { PAIR_TOKEN_CANDIDATES } from './pairTokens'

/**
 * Reading pons.
 *
 * Everything here is a view over the chain and needs no wallet. Nothing is
 * cached across calls except where the protocol itself promises a value is
 * immutable — fee rates on a curve, a token's name — so what the UI shows is
 * what the contract says right now.
 */

/* ------------------------------ Launch terms ------------------------------ */

export interface LaunchConfigView {
  id: bigint
  supply: bigint
  curveFeeBps: bigint
  /** Virtual quote reserve for a native launch. Sets the opening price. */
  phantomQuote: bigint
  /** Quote a native launch must collect to graduate. */
  graduationThreshold: bigint
  poolFee: number
  tickSpacing: number
  enabled: boolean
}

export interface QuoteAsset {
  /** The zero address for native ETH. */
  address: Address
  symbol: string
  name: string
  decimals: number
  isNative: boolean
  /**
   * Per-asset economics. Zero for the native asset — a native launch takes its
   * phantom reserve and threshold from the launch config instead.
   */
  phantomQuote: bigint
  graduationThreshold: bigint
}

export interface LaunchTerms {
  /** Sent as value on every launch, on top of any opening buy. */
  launchFee: bigint
  maxCreatorTaxBps: number
  /** The public gate. When closed, only whitelisted addresses can launch. */
  launchEnabled: boolean
  configs: LaunchConfigView[]
  quoteAssets: QuoteAsset[]
  readAt: number
}

const NATIVE_ASSET: Omit<QuoteAsset, 'phantomQuote' | 'graduationThreshold'> = {
  address: NATIVE_QUOTE,
  symbol: PONS_CHAIN.nativeCurrency.symbol,
  name: PONS_CHAIN.nativeCurrency.name,
  decimals: PONS_CHAIN.nativeCurrency.decimals,
  isNative: true,
}

/** The configs currently open for new launches, in id order. */
async function readLaunchConfigs(): Promise<LaunchConfigView[]> {
  const count = await ponsClient.readContract({
    address: PONS.factory,
    abi: factoryAbi,
    functionName: 'launchConfigCount',
  })
  const configs = await Promise.all(
    Array.from({ length: Number(count) }, (_, id) =>
      ponsClient.readContract({
        address: PONS.factory,
        abi: factoryAbi,
        functionName: 'getLaunchConfig',
        args: [BigInt(id)],
      }),
    ),
  )
  return configs.map((c, id) => ({ id: BigInt(id), ...c }))
}

/**
 * The quote assets the create form may safely offer.
 *
 * Each candidate is checked three ways: the factory still approves it, the
 * factory has recorded economics for it, and the token itself reports the
 * symbol and decimals the registry claims. Failing any one drops it — an asset
 * that would revert at launch should never appear in a picker.
 */
async function verifyQuoteAssets(): Promise<QuoteAsset[]> {
  const checked = await Promise.all(
    PAIR_TOKEN_CANDIDATES.map(async (candidate): Promise<QuoteAsset | null> => {
      try {
        const [approved, economics, symbol, decimals] = await Promise.all([
          ponsClient.readContract({
            address: PONS.factory,
            abi: factoryAbi,
            functionName: 'approvedPairTokens',
            args: [candidate.address],
          }),
          ponsClient.readContract({
            address: PONS.factory,
            abi: factoryAbi,
            functionName: 'pairTokenEconomics',
            args: [candidate.address],
          }),
          ponsClient.readContract({ address: candidate.address, abi: erc20Abi, functionName: 'symbol' }),
          ponsClient.readContract({ address: candidate.address, abi: erc20Abi, functionName: 'decimals' }),
        ])
        const [phantomQuote, graduationThreshold, recordedDecimals] = economics
        if (!approved || phantomQuote === 0n || graduationThreshold === 0n) return null
        if (symbol.toUpperCase() !== candidate.symbol.toUpperCase()) return null
        if (decimals !== candidate.decimals || recordedDecimals !== decimals) return null
        return { ...candidate, isNative: false, phantomQuote, graduationThreshold }
      } catch {
        return null
      }
    }),
  )
  return checked.filter((a): a is QuoteAsset => a !== null)
}

export async function readLaunchTerms(): Promise<LaunchTerms> {
  const read = <F extends 'launchFee' | 'maxCreatorTaxBps' | 'launchEnabled'>(functionName: F) =>
    ponsClient.readContract({ address: PONS.factory, abi: factoryAbi, functionName })

  const [launchFee, maxCreatorTaxBps, launchEnabled, configs, pairs] = await Promise.all([
    read('launchFee'),
    read('maxCreatorTaxBps'),
    read('launchEnabled'),
    readLaunchConfigs(),
    verifyQuoteAssets(),
  ])

  return {
    launchFee,
    maxCreatorTaxBps: Number(maxCreatorTaxBps),
    launchEnabled,
    configs,
    quoteAssets: [{ ...NATIVE_ASSET, phantomQuote: 0n, graduationThreshold: 0n }, ...pairs],
    readAt: Date.now(),
  }
}

/**
 * Whether `account` may launch right now. True while the public gate is open;
 * while it is closed, true only for whitelisted addresses. The contract
 * answers this in one call, so it is asked rather than inferred.
 */
export const canLaunch = (account: Address) =>
  ponsClient.readContract({
    address: PONS.factory,
    abi: factoryAbi,
    functionName: 'canLaunch',
    args: [account],
  })

/**
 * The curve a launch would open with, for the chosen config and quote asset.
 *
 * A native launch prices from the config; a custom-pair launch prices from the
 * per-asset economics, because a phantom reserve is a quantity of the quote
 * asset and only means anything in that asset's decimals.
 */
export function openingEconomics(config: LaunchConfigView, asset: QuoteAsset) {
  const phantomQuote = asset.isNative ? config.phantomQuote : asset.phantomQuote
  const graduationThreshold = asset.isNative ? config.graduationThreshold : asset.graduationThreshold
  // The share held back for the pool. Same arithmetic as the curve's own.
  const reservedTokens = (config.supply * phantomQuote) / (phantomQuote + graduationThreshold)
  return {
    phantomQuote,
    graduationThreshold,
    reservedTokens,
    sellableTokens: config.supply - reservedTokens,
    /** Opening spot price, in the quote asset, for display. */
    openingPrice:
      Number(formatUnits(phantomQuote, asset.decimals)) / Number(formatUnits(config.supply, 18)),
  }
}

/* ------------------------------ Launch state ------------------------------ */

export interface Socials {
  twitter: string
  telegram: string
  discord: string
  website: string
  farcaster: string
}

export interface QuoteRef {
  address: Address
  symbol: string
  decimals: number
  isNative: boolean
}

export interface CurveState {
  /** Pricing reserves — include the phantom quote. */
  quoteReserve: bigint
  tokenReserve: bigint
  /** Quote actually collected and still held, net of fees. */
  realQuoteReserve: bigint
  sellableTokens: bigint
  reservedTokens: bigint
  graduationThreshold: bigint
  readyToGraduate: boolean
  graduated: boolean
  /** Marginal price of one token in the quote asset — a spot rate for display. */
  price: number
  /** Raised against the threshold, 0..1. */
  progress: number
}

export interface LaunchView {
  token: Address
  curve: Address
  deployer: Address
  creatorFeeRecipient: Address
  phase: LaunchPhase
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
  logo: string
  description: string
  socials: Socials
  quote: QuoteRef
  feeBps: number
  creatorTaxBps: number
  buybackEnabled: boolean
  state: CurveState
  readAt: number
}

/**
 * A quote asset's symbol and decimals.
 *
 * Memoised, because a page of launches keeps naming the same handful of assets
 * and these are immutable for the life of an ERC-20. The shipped registry
 * answers most of them without a call at all.
 */
const quoteCache = new Map<string, QuoteRef>()

async function describeQuote(pairToken: Address): Promise<QuoteRef> {
  if (pairToken === NATIVE_QUOTE) {
    return { address: NATIVE_QUOTE, symbol: NATIVE_ASSET.symbol, decimals: 18, isNative: true }
  }
  const key = pairToken.toLowerCase()
  const cached = quoteCache.get(key)
  if (cached) return cached

  const known = PAIR_TOKEN_CANDIDATES.find((c) => c.address.toLowerCase() === key)
  const ref: QuoteRef = known
    ? { address: known.address, symbol: known.symbol, decimals: known.decimals, isNative: false }
    : await (async () => {
        const [symbol, decimals] = await Promise.all([
          ponsClient.readContract({ address: pairToken, abi: erc20Abi, functionName: 'symbol' }),
          ponsClient.readContract({ address: pairToken, abi: erc20Abi, functionName: 'decimals' }),
        ])
        return { address: getAddress(pairToken), symbol, decimals, isNative: false }
      })()

  quoteCache.set(key, ref)
  return ref
}

export async function readCurve(curve: Address, quoteDecimals: number): Promise<CurveState> {
  const read = <F extends
    | 'getReserves'
    | 'realQuoteReserve'
    | 'sellableTokens'
    | 'reservedTokens'
    | 'graduationThreshold'
    | 'readyToGraduate'
    | 'graduated'>(functionName: F) =>
    ponsClient.readContract({ address: curve, abi: curveAbi, functionName })

  const [reserves, realQuoteReserve, sellableTokens, reservedTokens, graduationThreshold, readyToGraduate, graduated] =
    await Promise.all([
      read('getReserves'),
      read('realQuoteReserve'),
      read('sellableTokens'),
      read('reservedTokens'),
      read('graduationThreshold'),
      read('readyToGraduate'),
      read('graduated'),
    ])
  const [quoteReserve, tokenReserve] = reserves

  return {
    quoteReserve,
    tokenReserve,
    realQuoteReserve,
    sellableTokens,
    reservedTokens,
    graduationThreshold,
    readyToGraduate,
    graduated,
    price:
      tokenReserve === 0n
        ? 0
        : Number(formatUnits(quoteReserve, quoteDecimals)) / Number(formatUnits(tokenReserve, 18)),
    progress:
      graduationThreshold === 0n
        ? 0
        : Math.min(1, Number(realQuoteReserve) / Number(graduationThreshold)),
  }
}

/** Everything the token page needs, in one read. Throws if pons never launched `token`. */
export async function readLaunch(token: Address): Promise<LaunchView> {
  const record = await ponsClient.readContract({
    address: PONS.factory,
    abi: factoryAbi,
    functionName: 'getLaunchedToken',
    args: [token],
  })
  if (!record.exists) throw new Error('pons v2 has no launch at that address.')

  const quote = await describeQuote(record.pairToken)
  const tokenRead = <F extends 'name' | 'symbol' | 'decimals' | 'totalSupply' | 'getTokenInfo'>(functionName: F) =>
    ponsClient.readContract({ address: record.token, abi: launchTokenAbi, functionName })

  const [name, symbol, decimals, totalSupply, info, feeBps, state] = await Promise.all([
    tokenRead('name'),
    tokenRead('symbol'),
    tokenRead('decimals'),
    tokenRead('totalSupply'),
    tokenRead('getTokenInfo'),
    ponsClient.readContract({ address: record.curve, abi: curveAbi, functionName: 'feeBps' }),
    readCurve(record.curve, quote.decimals),
  ])
  const [, logo, description, socials] = info

  return {
    token: record.token,
    curve: record.curve,
    deployer: record.deployer,
    creatorFeeRecipient: record.creatorFeeRecipient,
    phase: LAUNCH_PHASE[record.phase as 0 | 1 | 2 | 3] ?? 'trading',
    name,
    symbol,
    decimals,
    totalSupply,
    logo,
    description,
    socials: { ...socials },
    quote,
    feeBps: Number(feeBps),
    creatorTaxBps: record.creatorTaxBps,
    buybackEnabled: record.buybackEnabled,
    state,
    readAt: Date.now(),
  }
}

/** A holder's balance of a launch token. */
export const readTokenBalance = (token: Address, account: Address) =>
  ponsClient.readContract({ address: token, abi: launchTokenAbi, functionName: 'balanceOf', args: [account] })

/** A holder's balance of a quote asset — native or ERC-20. */
export async function readQuoteBalance(quote: QuoteRef, account: Address): Promise<bigint> {
  if (quote.isNative) return ponsClient.getBalance({ address: account })
  return ponsClient.readContract({ address: quote.address, abi: erc20Abi, functionName: 'balanceOf', args: [account] })
}

/* ------------------------------ Recent launches ------------------------------ */

export interface LaunchSummary {
  token: Address
  curve: Address
  deployer: Address
  name: string
  symbol: string
  phase: LaunchPhase
  quote: QuoteRef
  raised: bigint
  graduationThreshold: bigint
  progress: number
  blockNumber: bigint
  launchedAt: number | null
}

/** Robinhood Chain's block cadence, measured over 10,000 blocks. */
const BLOCK_MS = 100

const TOKEN_LAUNCHED = parseAbiItem(
  'event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)',
)

/**
 * The newest launches on the factory.
 *
 * Read from `TokenLaunched` logs rather than any pons service, so the list is
 * as trustworthy as the chain. Robinhood Chain mints a block roughly every
 * tenth of a second, so a window of 36,000 blocks is about an hour; when that
 * comes back short the window widens once, and then stops — a quiet hour is a
 * fact worth showing, not a reason to scan the whole chain.
 */
export async function listRecentLaunches(limit = 40): Promise<LaunchSummary[]> {
  const latest = await ponsClient.getBlockNumber()
  let logs = await ponsClient.getLogs({
    address: PONS.factory,
    event: TOKEN_LAUNCHED,
    fromBlock: latest > 36_000n ? latest - 36_000n : 0n,
    toBlock: latest,
  })
  if (logs.length < limit) {
    logs = await ponsClient.getLogs({
      address: PONS.factory,
      event: TOKEN_LAUNCHED,
      fromBlock: latest > 400_000n ? latest - 400_000n : 0n,
      toBlock: latest,
    })
  }

  const newest = logs.slice(-limit).reverse()
  if (!newest.length) return []

  // One block read anchors the rest: this chain mints on a fixed cadence, so a
  // launch's time follows from its block number. Reading a timestamp per launch
  // would be dozens of round trips for a figure shown as "4m ago".
  const blocks = new Map<bigint, number | null>()
  try {
    const anchor = await ponsClient.getBlock({ blockNumber: newest[0].blockNumber })
    const anchorMs = Number(anchor.timestamp) * 1000
    for (const log of newest) {
      blocks.set(log.blockNumber, anchorMs - Number(newest[0].blockNumber - log.blockNumber) * BLOCK_MS)
    }
  } catch {
    /* leave the times unknown rather than guessing from the wall clock */
  }

  let failures = 0
  const summaries = await Promise.all(
    newest.map(async (log): Promise<LaunchSummary | null> => {
      const { token, curve, deployer, pairToken, graduationThreshold } = log.args
      if (!token || !curve || !deployer || !pairToken || graduationThreshold === undefined) return null
      try {
        const [record, name, symbol, raised, quote] = await Promise.all([
          ponsClient.readContract({ address: PONS.factory, abi: factoryAbi, functionName: 'getLaunchedToken', args: [token] }),
          ponsClient.readContract({ address: token, abi: launchTokenAbi, functionName: 'name' }),
          ponsClient.readContract({ address: token, abi: launchTokenAbi, functionName: 'symbol' }),
          ponsClient.readContract({ address: curve, abi: curveAbi, functionName: 'realQuoteReserve' }),
          describeQuote(pairToken),
        ])
        return {
          token,
          curve,
          deployer,
          name,
          symbol,
          phase: LAUNCH_PHASE[record.phase as 0 | 1 | 2 | 3] ?? 'trading',
          quote,
          raised,
          graduationThreshold,
          progress: graduationThreshold === 0n ? 0 : Math.min(1, Number(raised) / Number(graduationThreshold)),
          blockNumber: log.blockNumber,
          launchedAt: blocks.get(log.blockNumber) ?? null,
        }
      } catch {
        failures++
        return null
      }
    }),
  )

  // An RPC that refuses every read must not read as "no launches" — the empty
  // state would be a lie, and the one thing a launchpad cannot do is quietly
  // claim the chain is idle.
  if (failures === newest.length) {
    throw new Error(`The RPC returned ${newest.length} launches but would not describe any of them.`)
  }
  return summaries.filter((s): s is LaunchSummary => s !== null)
}
