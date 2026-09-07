import {
  getAddress,
  isAddress,
  parseEventLogs,
  toHex,
  zeroAddress,
  type Address,
  type Hash,
} from 'viem'
import { curveAbi, factoryAbi, launchAndBuyAbi, ponsErrorsAbi } from './abi'
import { ponsClient, requirePonsSigner } from './client'
import { BPS, MAX_SNIPE_EXEMPTIONS, PONS, explorerTx } from './config'
import { canLaunch, openingEconomics, type LaunchConfigView, type QuoteAsset } from './read'
import { computeBuy, ensureAllowance, withSlippage } from './trade'

/**
 * Launching a token.
 *
 * One call to the factory — or to the launch-and-buy router when the creator
 * wants an opening buy in the same transaction, so nothing can trade between
 * the launch and that buy. Either way the terms are pinned: the economics hash
 * is read immediately before sending and passed back, so if the owner changes
 * the config in between the launch reverts rather than settling on terms the
 * creator never read.
 */

export interface LaunchDraft {
  name: string
  symbol: string
  /** An image URI — ipfs:// or https://. Stored on the token as a string. */
  logo: string
  description: string
  socials: {
    twitter: string
    telegram: string
    discord: string
    website: string
    farcaster: string
  }
  /** Empty means "the launching wallet". The router needs it explicit. */
  creatorFeeRecipient: string
  creatorTaxBps: number
  buybackEnabled: boolean
  config: LaunchConfigView
  quote: QuoteAsset
  /**
   * Addresses exempt from the opening snipe tax, for a team bundling its
   * opening buys across several wallets. The launcher and the fee recipient are
   * exempted by the contract regardless. Fixed at creation.
   */
  snipeTaxExemptions: string[]
  /** An opening buy in the quote asset, sent through the router. Zero for none. */
  openingBuy: bigint
  slippageBps: number
}

export type LaunchStep = 'checking' | 'approving' | 'confirm' | 'pending'

export interface LaunchResult {
  hash: Hash
  explorerUrl: string
  token: Address
  curve: Address
  /** Only for a launch-and-buy, from the CurveBuy event. */
  tokensOut?: bigint
}

/** Field-level problems the form can show next to the input. */
export function validateDraft(draft: LaunchDraft, maxCreatorTaxBps: number): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.name.trim()) errors.name = 'Give the token a name'
  if (draft.name.length > 64) errors.name = 'Keep the name under 64 characters'
  if (!draft.symbol.trim()) errors.symbol = 'Give the token a symbol'
  if (!/^[A-Za-z0-9]{1,12}$/.test(draft.symbol)) errors.symbol = 'Letters and numbers only, up to 12'
  if (draft.logo && !/^(ipfs:\/\/|https:\/\/)/.test(draft.logo)) errors.logo = 'Use an ipfs:// or https:// URI'
  if (draft.creatorFeeRecipient && !isAddress(draft.creatorFeeRecipient)) {
    errors.creatorFeeRecipient = 'Not a valid address'
  }
  if (draft.openingBuy > 0n && !draft.creatorFeeRecipient) {
    // The router cannot default it: token recipient, launcher and fee recipient may all differ.
    errors.creatorFeeRecipient = 'Set the fee recipient explicitly for a launch-and-buy'
  }
  if (draft.creatorTaxBps < 0 || draft.creatorTaxBps > maxCreatorTaxBps) {
    errors.creatorTaxBps = `Between 0 and ${maxCreatorTaxBps / 100}%`
  }
  if (!draft.config.enabled) errors.config = 'This launch configuration is disabled'
  if (draft.snipeTaxExemptions.length > MAX_SNIPE_EXEMPTIONS) {
    errors.snipeTaxExemptions = `At most ${MAX_SNIPE_EXEMPTIONS} addresses`
  }
  const bad = draft.snipeTaxExemptions.find((a) => !isAddress(a))
  if (bad) errors.snipeTaxExemptions = `${bad.slice(0, 10)}… is not a valid address`
  if (draft.slippageBps < 0 || draft.slippageBps > 5000) errors.slippageBps = 'Between 0% and 50%'
  return errors
}

/**
 * What an opening buy would return on the curve this launch opens with. The
 * recipient of a router buy is exempted from the snipe tax by the contract, so
 * none is applied here.
 */
export function quoteOpeningBuy(draft: LaunchDraft) {
  const economics = openingEconomics(draft.config, draft.quote)
  return computeBuy({
    quoteIn: draft.openingBuy,
    quoteReserve: economics.phantomQuote,
    tokenReserve: draft.config.supply,
    sellableTokens: economics.sellableTokens,
    feeBps: draft.config.curveFeeBps,
    creatorTaxBps: BigInt(draft.creatorTaxBps),
    snipeTaxBps: 0n,
  })
}

const factoryWithErrors = [...factoryAbi, ...ponsErrorsAbi] as const
const routerWithErrors = [...launchAndBuyAbi, ...ponsErrorsAbi] as const

export async function launchToken(
  draft: LaunchDraft,
  onPhase?: (phase: LaunchStep) => void,
): Promise<LaunchResult> {
  onPhase?.('checking')
  const { walletClient, account } = await requirePonsSigner()

  // The gate, the fee and the economics pin are read together, immediately
  // before sending, so the transaction carries the terms the creator was shown.
  const [allowed, launchFee, expectedEconomics] = await Promise.all([
    canLaunch(account),
    ponsClient.readContract({ address: PONS.factory, abi: factoryAbi, functionName: 'launchFee' }),
    ponsClient.readContract({
      address: PONS.factory,
      abi: factoryAbi,
      functionName: 'previewLaunchEconomics',
      args: [draft.config.id, draft.quote.address],
    }),
  ])
  if (!allowed) {
    throw new Error(
      'Launching is restricted to whitelisted addresses right now, and this wallet is not on the list.',
    )
  }

  // The curve and token are deployed with CREATE2 from this salt and the
  // launch's own terms, namespaced to the initiating wallet. Any unused value
  // will do; a fresh random one is the ordinary case.
  const salt = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const exemptions = draft.snipeTaxExemptions.map((a) => getAddress(a))
  const feeRecipient = draft.creatorFeeRecipient ? getAddress(draft.creatorFeeRecipient) : zeroAddress

  const params = {
    name: draft.name.trim(),
    symbol: draft.symbol.trim(),
    logo: draft.logo.trim(),
    description: draft.description.trim(),
    socials: {
      twitter: draft.socials.twitter.trim(),
      telegram: draft.socials.telegram.trim(),
      discord: draft.socials.discord.trim(),
      website: draft.socials.website.trim(),
      farcaster: draft.socials.farcaster.trim(),
    },
    creatorFeeRecipient: feeRecipient,
    creatorTaxBps: draft.creatorTaxBps,
    buybackEnabled: draft.buybackEnabled,
    expectedEconomics,
    salt,
  }

  let hash: Hash

  if (draft.openingBuy > 0n) {
    // Launch and buy, atomically. Native: the fee and the buy travel together
    // as value. ERC-20 pair: approve the router for the buy, send only the fee.
    if (!draft.quote.isNative) {
      await ensureAllowance(draft.quote.address, account, PONS.launchAndBuy, draft.openingBuy, onPhase)
    }
    const quote = quoteOpeningBuy(draft)
    const minTokensOut = withSlippage(quote.tokensOut, draft.slippageBps)
    const value = draft.quote.isNative ? launchFee + draft.openingBuy : launchFee

    const { request } = await ponsClient.simulateContract({
      account,
      address: PONS.launchAndBuy,
      abi: routerWithErrors,
      functionName: 'launchAndBuy',
      args: [params, draft.config.id, draft.quote.address, draft.openingBuy, minTokensOut, account, exemptions],
      value,
    })
    onPhase?.('confirm')
    hash = await walletClient.writeContract({ ...request, account, chain: ponsClient.chain })
  } else if (exemptions.length > 0) {
    const { request } = await ponsClient.simulateContract({
      account,
      address: PONS.factory,
      abi: factoryWithErrors,
      functionName: 'launchToken',
      args: [params, draft.config.id, draft.quote.address, exemptions],
      value: launchFee,
    })
    onPhase?.('confirm')
    hash = await walletClient.writeContract({ ...request, account, chain: ponsClient.chain })
  } else {
    const { request } = await ponsClient.simulateContract({
      account,
      address: PONS.factory,
      abi: factoryWithErrors,
      functionName: 'launchToken',
      args: [params, draft.config.id, draft.quote.address],
      value: launchFee,
    })
    onPhase?.('confirm')
    hash = await walletClient.writeContract({ ...request, account, chain: ponsClient.chain })
  }

  onPhase?.('pending')
  const mined = await ponsClient.waitForTransactionReceipt({ hash })
  if (mined.status === 'reverted') throw new Error('The launch was mined but reverted')

  // The addresses come from the event the factory emitted, never from a guess.
  const launched = parseEventLogs({ abi: factoryAbi, logs: mined.logs, eventName: 'TokenLaunched' })[0]
  if (!launched?.args.token || !launched.args.curve) {
    throw new Error(`The transaction was mined but no TokenLaunched event was found. Check ${explorerTx(hash)}`)
  }
  const bought = parseEventLogs({ abi: curveAbi, logs: mined.logs, eventName: 'CurveBuy' })[0]

  return {
    hash,
    explorerUrl: explorerTx(hash),
    token: launched.args.token,
    curve: launched.args.curve,
    tokensOut: bought?.args.tokensOut,
  }
}

/** Percent → basis points, clamped to the contract's range. */
export const percentToBps = (percent: number) =>
  Math.max(0, Math.min(Number(BPS), Math.round(percent * 100)))
