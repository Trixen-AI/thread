import type { Address } from 'viem'
import type { Post, TokenAttachment } from '@/types'
import { api } from '@/services/api/client'
import {
  PONS_CHAIN_ID,
  buy,
  describePonsError,
  launchToken,
  sell,
  type LaunchDraft,
  type LaunchResult,
  type LaunchStep,
  type QuoteRef,
  type TradePhase,
  type TradeResult,
} from '@/services/pons'
import { cachePosts, setUi, type AppState } from './appStore'
import { toast } from './toast'
import { refreshBalances } from './walletActions'

/**
 * The launchpad.
 *
 * Every write here goes to a pons contract through the user's own wallet, and
 * the social side — the thread announcing a token — is recorded only after the
 * chain has confirmed the launch. A thread for a token that never launched
 * would be a post about nothing.
 */

/* --------------------------------- Launch --------------------------------- */

export type LaunchProgress = LaunchStep | 'announcing'

export interface LaunchOutcome {
  result?: LaunchResult
  /** The thread that announced it, when one was requested and published. */
  post?: Post
  error?: string
  cancelled?: boolean
}

/** What a post carries to point at a launch. Everything else is read from the chain. */
export function tokenAttachmentFor(draft: LaunchDraft, result: LaunchResult): TokenAttachment {
  return {
    chainId: PONS_CHAIN_ID,
    address: result.token,
    curve: result.curve,
    name: draft.name.trim(),
    symbol: draft.symbol.trim(),
    quoteSymbol: draft.quote.symbol,
    logo: draft.logo.trim() || undefined,
    launchTx: result.hash,
  }
}

/**
 * Launches, then announces.
 *
 * The launch is the part that can fail expensively, so it goes first and the
 * thread follows only on a mined, non-reverted transaction. If the announce
 * step itself fails, the token still exists — the outcome says so, and the
 * token page offers to post the thread again.
 */
export async function launchAndAnnounce(
  draft: LaunchDraft,
  thread: { enabled: boolean; text: string },
  onProgress?: (step: LaunchProgress) => void,
): Promise<LaunchOutcome> {
  let result: LaunchResult
  try {
    result = await launchToken(draft, onProgress)
  } catch (error) {
    const { message, cancelled } = describePonsError(error)
    if (!cancelled) toast({ title: 'Launch failed', description: message, tone: 'error', icon: 'alert' })
    return { error: message, cancelled }
  }

  toast({
    title: `$${draft.symbol.trim()} is live`,
    description: `Launched on Robinhood Chain · ${result.hash.slice(0, 10)}…`,
    tone: 'success',
    icon: 'check',
  })
  void refreshBalances()

  if (!thread.enabled || !thread.text.trim()) return { result }

  onProgress?.('announcing')
  const post = await announceLaunch(tokenAttachmentFor(draft, result), thread.text)
  return { result, post }
}

/** Publishes a thread about a token. Returns nothing when the server refused. */
export async function announceLaunch(token: TokenAttachment, text: string): Promise<Post | undefined> {
  try {
    const { post } = await api.createPost({ text: text.trim().slice(0, 2000), audience: 'everyone', token })
    cachePosts([post])
    toast({ title: 'Thread posted', description: `Your launch thread for $${token.symbol} is live.`, tone: 'brand', icon: 'check' })
    return post
  } catch (error) {
    toast({
      title: 'Token launched, thread not posted',
      description: error instanceof Error ? error.message : 'The MESH server refused the post.',
      tone: 'error',
      icon: 'alert',
    })
  }
}

/** Opens the composer with a token already attached — writing into its thread. */
export const openTokenThreadComposer = (token: TokenAttachment) =>
  setUi({ composerOpen: true, composerToken: token })

/* --------------------------------- Trading --------------------------------- */

export interface TradeOutcome {
  result?: TradeResult
  error?: string
  cancelled?: boolean
}

export async function buyOnCurve(
  curve: Address,
  quote: QuoteRef,
  quoteIn: bigint,
  minTokensOut: bigint,
  symbol: string,
  onPhase?: (phase: TradePhase) => void,
): Promise<TradeOutcome> {
  try {
    const result = await buy(curve, quote, quoteIn, minTokensOut, onPhase)
    toast({
      title: `Bought $${symbol}`,
      description: result.refund ? 'The curve filled to its edge and refunded the rest.' : 'Confirmed on Robinhood Chain.',
      tone: 'success',
      icon: 'coins',
    })
    void refreshBalances()
    return { result }
  } catch (error) {
    const { message, cancelled } = describePonsError(error)
    if (!cancelled) toast({ title: 'Buy failed', description: message, tone: 'error', icon: 'alert' })
    return { error: message, cancelled }
  }
}

export async function sellOnCurve(
  curve: Address,
  token: Address,
  tokensIn: bigint,
  minQuoteOut: bigint,
  symbol: string,
  onPhase?: (phase: TradePhase) => void,
): Promise<TradeOutcome> {
  try {
    const result = await sell(curve, token, tokensIn, minQuoteOut, onPhase)
    toast({ title: `Sold $${symbol}`, description: 'Confirmed on Robinhood Chain.', tone: 'success', icon: 'coins' })
    void refreshBalances()
    return { result }
  } catch (error) {
    const { message, cancelled } = describePonsError(error)
    if (!cancelled) toast({ title: 'Sell failed', description: message, tone: 'error', icon: 'alert' })
    return { error: message, cancelled }
  }
}

/* -------------------------------- Selectors -------------------------------- */

/** Every post in the cache that carries this token — its thread, newest first. */
export const selectTokenPosts = (s: AppState, address: string): Post[] =>
  s.posts
    .filter((p) => p.token && p.token.address.toLowerCase() === address.toLowerCase())
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

/** Whether the signed-in viewer is on the pons chain with a real wallet. */
export const selectPonsReady = (s: AppState) =>
  s.wallet.status === 'connected' && !s.wallet.isDemo && s.wallet.account?.chainId === PONS_CHAIN_ID

