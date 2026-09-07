import type { Community, TokenSymbol, TransferReceipt } from '@/types'
import { patchById } from '@/lib/store'
import { uid } from '@/lib/utils'
import { ApiError, api } from '@/services/api/client'
import {
  CollectibleService,
  IdentityService,
  MembershipService,
  PaymentService,
  WalletService,
  ReownDismissed,
  connectWithReown,
  demoProvider,
  evmProvider,
  restoreReown,
  useDemoWallet,
  useRealWallet,
  type WalletOption,
} from '@/services/blockchain'
import {
  appStore,
  cachePosts,
  cacheUsers,
  getState,
  isMember,
  selectCommunity,
  selectCurrentUser,
  selectPost,
  selectUser,
  setWallet,
} from './appStore'
import { isUserRejection, reportError, toast } from './toast'

/**
 * The wallet and everything that moves value.
 *
 * Two providers sit behind this: the local demo one, and a real browser wallet
 * over EIP-1193. Which is active decides whether a transfer produces a demo
 * reference or an actual transaction hash — nothing here fakes the difference.
 */

/* ------------------------------ Connection ------------------------------ */

const MODE_KEY = 'mesh.wallet.v1'
type Mode = 'demo' | 'evm'

const rememberMode = (mode: Mode | null) => {
  try {
    if (mode) localStorage.setItem(MODE_KEY, mode)
    else localStorage.removeItem(MODE_KEY)
  } catch {
    /* storage unavailable */
  }
}

const rememberedMode = (): Mode | null => {
  try {
    return localStorage.getItem(MODE_KEY) as Mode | null
  } catch {
    return null
  }
}

/** Re-reads accounts and balances after the wallet changes them on its own. */
async function syncWallet() {
  const accounts = await WalletService.accounts()
  const account = accounts[0] ?? null
  if (!account) {
    setWallet({ status: 'disconnected', account: null, accounts: [], balances: [] })
    return
  }
  setWallet({
    status: 'connected',
    account,
    accounts,
    balances: await WalletService.balances(account.address),
    isDemo: WalletService.isDemo(),
    error: undefined,
  })
}

// A wallet can switch account or network at any moment; follow it.
evmProvider.onChange(() => {
  void syncWallet()
})

export async function connectWallet(
  options: { silent?: boolean; wallet?: WalletOption; demo?: boolean } = {},
) {
  if (getState().wallet.status === 'connecting') return
  setWallet({ status: 'connecting', error: undefined })

  try {
    if (options.demo) {
      useDemoWallet()
      rememberMode('demo')
    } else if (options.wallet) {
      useRealWallet(options.wallet)
      rememberMode('evm')
    }

    const accounts = await WalletService.connect()
    const account = accounts[0] ?? null
    const balances = account ? await WalletService.balances(account.address) : []

    setWallet({
      status: 'connected',
      account,
      accounts,
      balances,
      isDemo: WalletService.isDemo(),
    })

    if (options.silent) return
    toast({
      title: 'Wallet connected',
      description: WalletService.isDemo()
        ? 'Demo wallet — no blockchain is connected.'
        : `${WalletService.providerLabel()} · ${account?.chainName ?? 'unknown network'}`,
      tone: 'brand',
      icon: 'wallet',
    })
  } catch (error) {
    const message = isUserRejection(error)
      ? 'Connection cancelled in your wallet'
      : error instanceof Error
        ? error.message
        : 'Could not connect'
    setWallet({ status: 'error', error: message })
    if (!options.silent) toast({ title: message, tone: 'error', icon: 'alert' })
  }
}

/**
 * Opens Reown's connect modal and, once a wallet is chosen and connected, hands
 * the provider to the rest of the app through the ordinary path.
 *
 * Closing the sheet is a decision, not a failure — it leaves the wallet state
 * exactly as it was and says nothing.
 */
export async function connectReown() {
  if (getState().wallet.status === 'connecting') return
  try {
    const wallet = await connectWithReown()
    await connectWallet({ wallet })
  } catch (error) {
    if (error instanceof ReownDismissed) return
    const message = error instanceof Error ? error.message : 'Could not connect'
    setWallet({ status: 'error', error: message })
    toast({ title: message, tone: 'error', icon: 'alert' })
  }
}

export async function disconnectWallet() {
  await WalletService.disconnect()
  setWallet({ status: 'disconnected', account: null, accounts: [], balances: [] })
  appStore.set((s) => ({ ...s, ownershipVerified: false }))
  rememberMode(null)
  useDemoWallet()
  toast({ title: 'Wallet disconnected', tone: 'default', icon: 'wallet' })
}

/**
 * Restores a previous connection on boot.
 *
 * A real wallet is reconnected only when it still has this site authorised, so
 * loading the page never pops a wallet prompt on its own.
 */
export function restoreWalletLink() {
  // Only a real wallet is ever restored. The demo provider is the stand-in the
  // app boots with, not something anyone chooses any more.
  if (rememberedMode() !== 'evm') return

  // AppKit keeps its own session, so a reload picks the wallet back up without
  // opening anything. Nothing is restored unless it reports a live connection —
  // loading the page must never pop a wallet prompt on its own.
  void restoreReown().then((wallet) => {
    if (!wallet) return
    useRealWallet(wallet)
    void evmProvider.reconnect().then((accounts) => {
      if (accounts.length) void syncWallet()
    })
  })
}

export async function switchAccount(address: string) {
  const account = getState().wallet.accounts.find((a) => a.address === address)
  if (!account) return
  setWallet({ account, balances: await WalletService.balances(address) })
  appStore.set((s) => ({ ...s, ownershipVerified: false }))
  toast({ title: `Switched to ${account.label}`, tone: 'default', icon: 'wallet' })
}

/** Asks the wallet to move to another network. */
export async function switchNetwork(chainId: number) {
  try {
    await evmProvider.switchChain(chainId)
    await syncWallet()
  } catch (error) {
    const unknownChain = error instanceof Error && /4902|unrecognized/i.test(error.message)
    toast({
      title: unknownChain ? 'Add that network in your wallet first' : 'Network not switched',
      tone: 'error',
      icon: 'alert',
    })
  }
}

export async function refreshBalances() {
  const account = getState().wallet.account
  if (!account) return
  setWallet({ balances: await WalletService.balances(account.address) })
}

export function creditDemoWallet(asset: TokenSymbol, amount: number) {
  demoProvider.credit(asset, amount)
  void refreshBalances()
}

/* ------------------------------- Identity ------------------------------- */

/**
 * Proves control of the connected address and links it to the MESH account.
 *
 * The wallet signs a server-issued nonce and the server recovers the signer, so
 * "verified" means verified rather than asserted. The demo provider cannot
 * sign, and says so instead of flipping a badge.
 */
export async function verifyOwnership() {
  const account = getState().wallet.account
  if (!account) return

  try {
    const challenge = await api.walletNonce()
    const proof = await IdentityService.proveOwnership(account.address, challenge.message)

    if (!proof.signature) {
      toast({
        title: 'Cannot verify in demo mode',
        description: 'The demo wallet holds no keys, so it cannot sign a proof.',
        tone: 'default',
        icon: 'alert',
      })
      return proof
    }

    const { user } = await api.linkWallet({
      address: proof.address,
      chainId: account.chainId,
      nonce: challenge.nonce,
      message: challenge.message,
      signature: proof.signature,
    })

    cacheUsers([user])
    appStore.set((s) => ({ ...s, me: user, ownershipVerified: true }))
    toast({
      title: 'Wallet verified',
      description: 'Other people can now tip this address.',
      tone: 'success',
      icon: 'check',
    })
    return { ...proof, verified: true }
  } catch (error) {
    toast({
      title: isUserRejection(error)
        ? 'Signature cancelled in your wallet'
        : error instanceof ApiError
          ? error.message
          : 'Could not verify the wallet',
      tone: 'error',
      icon: 'alert',
    })
  }
}

export async function unlinkWallet() {
  try {
    const { user } = await api.unlinkWallet()
    cacheUsers([user])
    appStore.set((s) => ({ ...s, me: user, ownershipVerified: false }))
    toast({ title: 'Wallet unlinked from your profile', tone: 'default', icon: 'wallet' })
  } catch (error) {
    reportError(error, 'Could not unlink')
  }
}

/* -------------------------------- Payments -------------------------------- */

export interface PaymentOutcome {
  receipt?: TransferReceipt
  error?: string
}

async function requireWallet(): Promise<boolean> {
  if (getState().wallet.status === 'connected') return true
  await connectWallet()
  return getState().wallet.status === 'connected'
}

const failure = (error: unknown, fallback: string): PaymentOutcome => ({
  error: isUserRejection(error)
    ? 'Cancelled in your wallet'
    : error instanceof Error
      ? error.message
      : fallback,
})

/**
 * Where value should be sent for a MESH account.
 *
 * On a real chain this must be an address the recipient proved they control.
 * The demo provider has no addresses, so it takes a handle reference instead.
 */
function payTo(user: { handle: string; walletAddress?: string }): string {
  if (WalletService.isDemo()) return `mesh:@${user.handle}`
  if (!user.walletAddress) {
    throw new Error(`@${user.handle} has not linked a wallet, so there is nowhere to send this.`)
  }
  return user.walletAddress
}

export async function sendTip(
  target: { userId: string; postId?: string },
  amount: number,
  asset: TokenSymbol,
): Promise<PaymentOutcome> {
  if (!(await requireWallet())) return { error: 'Wallet not connected' }
  const recipient = selectUser(getState(), target.userId)

  try {
    const receipt = await PaymentService.pay({
      purpose: 'tip',
      to: payTo(recipient),
      toLabel: `@${recipient.handle}`,
      amount,
      asset,
      memo: target.postId ? 'Tip on a post' : 'Tip',
    })

    // Record the social side, tagged with how the value actually settled.
    try {
      const { post } = await api.recordTip({
        toUserId: target.userId,
        postId: target.postId,
        amount,
        asset,
        settlement: receipt.settlement.kind,
      })
      if (post) cachePosts([post])
    } catch {
      /* the transfer happened; the feed count catches up on the next refresh */
    }

    await refreshBalances()
    return { receipt }
  } catch (error) {
    return failure(error, 'Payment failed')
  }
}

export async function collectPost(postId: string): Promise<PaymentOutcome> {
  const post = selectPost(getState(), postId)
  if (!post?.collectible) return { error: 'This post is not collectible' }
  if (post.collectible.collectedByMe) return { error: 'Already collected' }
  if (!(await requireWallet())) return { error: 'Wallet not connected' }

  const author = selectUser(getState(), post.authorId)
  const quote = CollectibleService.quote(post.collectible.price, post.collectible.asset)

  try {
    const receipt = await PaymentService.pay({
      purpose: 'collect',
      to: payTo(author),
      toLabel: `@${author.handle}`,
      amount: quote.price,
      asset: quote.asset,
      memo: 'Collect post',
    })
    const { post: updated } = await api.react(postId, 'collect', true)
    cachePosts([updated])
    await refreshBalances()
    return { receipt }
  } catch (error) {
    return failure(error, 'Collect failed')
  }
}

export async function buyMarketplaceItem(itemId: string): Promise<PaymentOutcome> {
  const state = getState()
  const item = state.marketplace.find((i) => i.id === itemId)
  if (!item) return { error: 'Item not found' }
  if (!WalletService.isDemo()) {
    return {
      error:
        'The marketplace is part of the local demo layer and has no contract to buy from on a real chain.',
    }
  }
  if (!(await requireWallet())) return { error: 'Wallet not connected' }

  try {
    const receipt = await PaymentService.pay({
      purpose: item.category === 'membership' ? 'membership' : 'purchase',
      to: `mesh:item/${item.id}`,
      toLabel: item.title,
      amount: item.price,
      asset: item.asset,
    })
    appStore.set((prev) => ({
      ...prev,
      marketplace: patchById(prev.marketplace, itemId, { ownedByMe: true }),
      collectibles: item.collectionId
        ? [
            {
              id: uid('nft'),
              name: item.title,
              collection: item.title,
              collectionId: item.collectionId,
              scene: item.scene,
              tone: item.tone,
              acquiredAt: new Date().toISOString(),
              floor: item.price,
              floorAsset: item.asset,
            },
            ...prev.collectibles,
          ]
        : prev.collectibles,
    }))
    await refreshBalances()
    return { receipt }
  } catch (error) {
    return failure(error, 'Purchase failed')
  }
}

export async function sendTokens(
  toLabel: string,
  to: string,
  amount: number,
  asset: TokenSymbol,
  memo?: string,
): Promise<PaymentOutcome> {
  if (!(await requireWallet())) return { error: 'Wallet not connected' }
  try {
    const receipt = await PaymentService.pay({
      purpose: 'transfer',
      to,
      toLabel,
      amount,
      asset,
      memo,
    })
    await refreshBalances()
    return { receipt }
  } catch (error) {
    return failure(error, 'Transfer failed')
  }
}

/* ------------------------- Communities (local demo) ----------------------- */

export function checkAccess(community: Community) {
  const state = getState()
  return MembershipService.check(community.access, {
    connected: state.wallet.status === 'connected',
    balances: state.wallet.balances,
    collectibles: state.collectibles,
    reputation: selectCurrentUser(state).reputation,
  })
}

export function joinCommunity(communityId: string) {
  const state = getState()
  const community = selectCommunity(state, communityId)
  if (!community || isMember(state, communityId) || !state.me) return

  const memberNumber = community.members + 1
  const credential = community.credential
    ? MembershipService.issueCredential(community, memberNumber)
    : undefined

  appStore.set((prev) => ({
    ...prev,
    memberships: [
      ...prev.memberships,
      {
        communityId,
        userId: prev.me!.id,
        role: 'member',
        joinedAt: new Date().toISOString(),
        memberNumber,
      },
    ],
    credentials: credential ? [...prev.credentials, credential] : prev.credentials,
    communities: patchById(prev.communities, communityId, (c) => ({ members: c.members + 1 })),
  }))

  toast({
    title: `Joined ${community.name}`,
    description: credential
      ? `Member #${memberNumber} · credential issued`
      : `You are member #${memberNumber}.`,
    tone: 'success',
    icon: 'users',
  })
}

export function leaveCommunity(communityId: string) {
  const community = selectCommunity(getState(), communityId)
  appStore.set((prev) => ({
    ...prev,
    memberships: prev.memberships.filter((m) => m.communityId !== communityId),
    credentials: prev.credentials.filter((c) => c.communityId !== communityId),
    communities: patchById(prev.communities, communityId, (c) => ({
      members: Math.max(0, c.members - 1),
    })),
  }))
  toast({ title: `Left ${community?.name ?? 'community'}`, tone: 'default', icon: 'check' })
}

export async function payForCommunity(communityId: string): Promise<PaymentOutcome> {
  const community = selectCommunity(getState(), communityId)
  const paid = community?.access.anyOf.find((c) => c.kind === 'paid')
  if (!community || paid?.kind !== 'paid') return { error: 'No payment required' }
  if (!(await requireWallet())) return { error: 'Wallet not connected' }

  try {
    const receipt = await PaymentService.pay({
      purpose: 'membership',
      to: `mesh:community/${community.slug}`,
      toLabel: community.name,
      amount: paid.price,
      asset: paid.asset,
    })
    joinCommunity(communityId)
    await refreshBalances()
    return { receipt }
  } catch (error) {
    return failure(error, 'Payment failed')
  }
}
