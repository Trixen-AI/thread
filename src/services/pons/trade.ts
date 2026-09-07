import { erc20Abi, parseEventLogs, type Address, type Hash } from 'viem'
import { curveAbi, ponsErrorsAbi } from './abi'
import { ponsClient, requirePonsSigner } from './client'
import { BPS, explorerTx } from './config'
import type { QuoteRef } from './read'

/**
 * Trading against a curve.
 *
 * The curve exposes no quote function: pricing is deterministic and cheap to
 * reproduce, so the quote is computed here from the curve's reserves and its
 * fee rates, in the same integer order the contract uses. When nothing moves
 * between the quote and the trade, the two agree to the wei.
 */

/* --------------------------------- Maths --------------------------------- */

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b

/** Constant product, no fee — both directions charge fees outside this step. */
export const amountOut = (inAmount: bigint, reserveIn: bigint, reserveOut: bigint) =>
  (inAmount * reserveOut) / (reserveIn + inAmount)

export const amountIn = (outAmount: bigint, reserveIn: bigint, reserveOut: bigint) =>
  (outAmount * reserveIn) / (reserveOut - outAmount) + 1n

export interface BuyInputs {
  quoteIn: bigint
  quoteReserve: bigint
  tokenReserve: bigint
  sellableTokens: bigint
  feeBps: bigint
  creatorTaxBps: bigint
  /** Raw reading from `currentSnipeTaxBps(recipient)`. Zero after the window. */
  snipeTaxBps: bigint
}

export interface BuyQuote {
  tokensOut: bigint
  /** What the curve actually keeps. Less than `quoteIn` on a clamped fill. */
  spent: bigint
  refund: bigint
  /** Effective snipe tax after the protocol's cap, for display. */
  snipeTaxBps: bigint
  /** Average price paid, quote per token, as a float for display. */
  clamped: boolean
}

/**
 * Quote asset in, launch token out.
 *
 * Every fee comes off the input before the curve prices the trade. A buy that
 * would cross the reserved allocation fills to the edge, and the input is
 * repriced from the token side so the rest is refunded.
 */
export function computeBuy(i: BuyInputs): BuyQuote {
  // The snipe tax is capped so the buyer always nets at least 1% of spend.
  let snipeBps = i.snipeTaxBps
  if (snipeBps > 0n) {
    const max = BPS - i.feeBps - i.creatorTaxBps - 100n
    if (snipeBps > max) snipeBps = max
  }

  let spent = i.quoteIn
  const fee = (spent * i.feeBps) / BPS
  const tax = (spent * i.creatorTaxBps) / BPS
  const snipe = (spent * snipeBps) / BPS
  let tokensOut = amountOut(spent - fee - tax - snipe, i.quoteReserve, i.tokenReserve)

  let clamped = false
  if (tokensOut > i.sellableTokens) {
    clamped = true
    tokensOut = i.sellableTokens
    const net = amountIn(i.sellableTokens, i.quoteReserve, i.tokenReserve)
    const grossed = ceilDiv(net * BPS, BPS - i.feeBps - i.creatorTaxBps - snipeBps)
    spent = grossed < i.quoteIn ? grossed : i.quoteIn
  }

  return { tokensOut, spent, refund: i.quoteIn - spent, snipeTaxBps: snipeBps, clamped }
}

export interface SellInputs {
  tokensIn: bigint
  quoteReserve: bigint
  tokenReserve: bigint
  feeBps: bigint
  creatorTaxBps: bigint
}

/** Launch token in, quote asset out. Priced first, fees off the output, no snipe tax. */
export function computeSell(i: SellInputs): { quoteOut: bigint; gross: bigint } {
  const gross = amountOut(i.tokensIn, i.tokenReserve, i.quoteReserve)
  const fee = (gross * i.feeBps) / BPS
  const tax = (gross * i.creatorTaxBps) / BPS
  return { quoteOut: gross - fee - tax, gross }
}

/**
 * The minimum output for a slippage tolerance, sized from the rate rather than
 * the total — the curve compares the price you accepted against the price you
 * received, so a clamped fill that honours the rate still settles.
 */
export const withSlippage = (amount: bigint, slippageBps: number) =>
  (amount * (BPS - BigInt(slippageBps))) / BPS

/* --------------------------------- Quotes --------------------------------- */

export interface CurveRates {
  feeBps: bigint
  creatorTaxBps: bigint
}

/** The rates are immutable for the life of a launch, so they are safe to hold. */
export async function readRates(curve: Address): Promise<CurveRates> {
  const [feeBps, creatorTaxBps] = await Promise.all([
    ponsClient.readContract({ address: curve, abi: curveAbi, functionName: 'feeBps' }),
    ponsClient.readContract({ address: curve, abi: curveAbi, functionName: 'creatorTaxBps' }),
  ])
  return { feeBps, creatorTaxBps }
}

export async function quoteBuy(curve: Address, quoteIn: bigint, recipient: Address, rates: CurveRates) {
  const [reserves, sellableTokens, snipeTaxBps] = await Promise.all([
    ponsClient.readContract({ address: curve, abi: curveAbi, functionName: 'getReserves' }),
    ponsClient.readContract({ address: curve, abi: curveAbi, functionName: 'sellableTokens' }),
    ponsClient.readContract({ address: curve, abi: curveAbi, functionName: 'currentSnipeTaxBps', args: [recipient] }),
  ])
  const [quoteReserve, tokenReserve] = reserves
  return computeBuy({ quoteIn, quoteReserve, tokenReserve, sellableTokens, snipeTaxBps, ...rates })
}

export async function quoteSell(curve: Address, tokensIn: bigint, rates: CurveRates) {
  const [quoteReserve, tokenReserve] = await ponsClient.readContract({
    address: curve,
    abi: curveAbi,
    functionName: 'getReserves',
  })
  return computeSell({ tokensIn, quoteReserve, tokenReserve, ...rates })
}

/* --------------------------------- Trades --------------------------------- */

export type TradePhase = 'approving' | 'confirm' | 'pending'

export interface TradeResult {
  hash: Hash
  explorerUrl: string
  /** From the event, never from the request — the last buy of a launch can fill short. */
  tokensOut?: bigint
  quoteOut?: bigint
  refund?: bigint
}

const curveWithErrors = [...curveAbi, ...ponsErrorsAbi] as const

/**
 * Grants `spender` exactly `amount` of an ERC-20 when the current allowance is
 * short. An exact approval rather than unlimited: the spender is a contract the
 * user has never audited, and the next trade can approve again.
 */
export async function ensureAllowance(
  token: Address,
  owner: Address,
  spender: Address,
  amount: bigint,
  onPhase?: (phase: TradePhase) => void,
) {
  const allowance = await ponsClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  })
  if (allowance >= amount) return
  const { walletClient } = await requirePonsSigner()
  onPhase?.('approving')
  const hash = await walletClient.writeContract({
    account: owner,
    chain: ponsClient.chain,
    address: token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  })
  const mined = await ponsClient.waitForTransactionReceipt({ hash })
  if (mined.status === 'reverted') throw new Error('The approval was mined but reverted')
}

export async function buy(
  curve: Address,
  quote: QuoteRef,
  quoteIn: bigint,
  minTokensOut: bigint,
  onPhase?: (phase: TradePhase) => void,
): Promise<TradeResult> {
  const { walletClient, account } = await requirePonsSigner()

  // A custom-pair launch spends an ERC-20: approve the curve first, send no value.
  if (!quote.isNative) await ensureAllowance(quote.address, account, curve, quoteIn, onPhase)

  // Simulate before asking for a signature, so a revert is explained instead of paid for.
  const { request } = await ponsClient.simulateContract({
    account,
    address: curve,
    abi: curveWithErrors,
    functionName: 'buy',
    args: [quoteIn, minTokensOut, account],
    value: quote.isNative ? quoteIn : 0n,
  })

  onPhase?.('confirm')
  const hash = await walletClient.writeContract({ ...request, account, chain: ponsClient.chain })
  onPhase?.('pending')
  const mined = await ponsClient.waitForTransactionReceipt({ hash })
  if (mined.status === 'reverted') throw new Error('The buy was mined but reverted')

  const bought = parseEventLogs({ abi: curveAbi, logs: mined.logs, eventName: 'CurveBuy' })[0]
  const refunded = parseEventLogs({ abi: curveAbi, logs: mined.logs, eventName: 'CurveBuyRefunded' })[0]
  return {
    hash,
    explorerUrl: explorerTx(hash),
    tokensOut: bought?.args.tokensOut,
    refund: refunded?.args.refund,
  }
}

/**
 * Sell tokens back to the curve.
 *
 * The curve pulls the tokens with `transferFrom`, so the seller has to approve
 * it first — including on a native-quote launch, where nothing else in the
 * trade involves an ERC-20. This is not in the pons documentation, which
 * mentions approval only for the buy leg of a custom-pair launch; it was found
 * by simulating sells against live curves, where every holder with a zero
 * allowance reverted with `ERC20InsufficientAllowance` and every holder with an
 * allowance settled. Without this step a holder's first sell always fails.
 */
export async function sell(
  curve: Address,
  token: Address,
  tokensIn: bigint,
  minQuoteOut: bigint,
  onPhase?: (phase: TradePhase) => void,
): Promise<TradeResult> {
  const { walletClient, account } = await requirePonsSigner()

  await ensureAllowance(token, account, curve, tokensIn, onPhase)

  const { request } = await ponsClient.simulateContract({
    account,
    address: curve,
    abi: curveWithErrors,
    functionName: 'sell',
    args: [tokensIn, minQuoteOut, account],
  })

  onPhase?.('confirm')
  const hash = await walletClient.writeContract({ ...request, account, chain: ponsClient.chain })
  onPhase?.('pending')
  const mined = await ponsClient.waitForTransactionReceipt({ hash })
  if (mined.status === 'reverted') throw new Error('The sell was mined but reverted')

  const sold = parseEventLogs({ abi: curveAbi, logs: mined.logs, eventName: 'CurveSell' })[0]
  return { hash, explorerUrl: explorerTx(hash), quoteOut: sold?.args.quoteOut }
}
