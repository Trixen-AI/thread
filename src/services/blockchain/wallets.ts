import type { EIP1193Provider } from 'viem'

/**
 * Wallet discovery.
 *
 * Browser wallets used to fight over `window.ethereum`, so whichever extension
 * loaded last won and the others were invisible. EIP-6963 fixed that: wallets
 * announce themselves and the page collects them. We listen for announcements
 * and fall back to `window.ethereum` for wallets that never adopted it.
 */

export interface WalletOption {
  /** EIP-6963 rdns, e.g. `io.metamask`. Synthetic for the legacy fallback. */
  id: string
  name: string
  /** Data-URI icon supplied by the wallet. */
  icon?: string
  provider: EIP1193Provider
  /**
   * Tears down a session that lives outside the page, for transports that have
   * one. An extension has nothing to end; a WalletConnect pairing does, and
   * leaving it alive would keep MESH listed as connected on the user's phone.
   */
  disconnect?: () => Promise<void>
}

interface Eip6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string }
  provider: EIP1193Provider
}

const found = new Map<string, WalletOption>()
const listeners = new Set<(wallets: WalletOption[]) => void>()

const snapshot = () => [...found.values()]
const emit = () => listeners.forEach((l) => l(snapshot()))

function onAnnounce(event: Event) {
  const detail = (event as CustomEvent<Eip6963Detail>).detail
  if (!detail?.info?.rdns || found.has(detail.info.rdns)) return
  found.set(detail.info.rdns, {
    id: detail.info.rdns,
    name: detail.info.name,
    icon: detail.info.icon,
    provider: detail.provider,
  })
  emit()
}

let started = false

/** Begins listening and asks any installed wallets to announce themselves. */
export function discoverWallets() {
  if (started || typeof window === 'undefined') return
  started = true

  window.addEventListener('eip6963:announceProvider', onAnnounce)
  window.dispatchEvent(new Event('eip6963:requestProvider'))

  // Wallets that predate EIP-6963 only ever set window.ethereum.
  const legacy = (window as { ethereum?: EIP1193Provider }).ethereum
  if (legacy && found.size === 0) {
    found.set('injected', { id: 'injected', name: 'Browser wallet', provider: legacy })
    emit()
  }
}

export function getWallets(): WalletOption[] {
  discoverWallets()
  return snapshot()
}

export function subscribeWallets(listener: (wallets: WalletOption[]) => void) {
  discoverWallets()
  listeners.add(listener)
  listener(snapshot())
  return () => listeners.delete(listener)
}

/** True when at least one browser wallet is installed. */
export const hasWallet = () => getWallets().length > 0

const LAST_WALLET_KEY = 'mesh.wallet.rdns'

export const rememberWallet = (id: string | null) => {
  try {
    if (id) localStorage.setItem(LAST_WALLET_KEY, id)
    else localStorage.removeItem(LAST_WALLET_KEY)
  } catch {
    /* storage unavailable */
  }
}

export const lastWalletId = (): string | null => {
  try {
    return localStorage.getItem(LAST_WALLET_KEY)
  } catch {
    return null
  }
}
