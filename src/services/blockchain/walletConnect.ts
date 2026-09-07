import type { EIP1193Provider } from 'viem'
import type { EthereumProvider as EthereumProviderClass } from '@walletconnect/ethereum-provider'
import { KNOWN_CHAINS, robinhoodChain } from './chains'
import type { WalletOption } from './wallets'

/**
 * WalletConnect, over Reown.
 *
 * A phone wallet is not installed in the browser, so EIP-6963 never announces
 * it. Reown's relay bridges the gap: the page shows a QR code, the wallet
 * scans it, and from then on the pair speaks the same EIP-1193 dialect an
 * extension would — which is the whole reason this fits without disturbing
 * anything. MESH already talks to wallets through one interface, so this is a
 * transport, not a second wallet layer.
 *
 * The project id is public. It identifies the app to the relay and ships in the
 * bundle like any other client config; what protects it is the allowed-domains
 * list on the Reown project, not secrecy. Without one, WalletConnect is simply
 * not offered — and the picker says why rather than failing at the tap.
 */

const PROJECT_ID = (import.meta.env.VITE_REOWN_PROJECT_ID ?? '').trim()

/**
 * The app's canonical URL, as declared to the wallet.
 *
 * Reown verifies a connection by checking this against the domains registered
 * on the project, and the wallet reports the result — so it has to name a
 * domain that is actually registered there.
 *
 * The live origin is the default, and it is the right one almost always: it
 * matches wherever the person really is, including Netlify preview builds.
 * `VITE_APP_URL` overrides it for the case where every session should be
 * attributed to one canonical domain. Set it only to a domain that is
 * registered on the Reown project — pointing it at an unregistered one makes
 * the mismatch worse than leaving it alone.
 */
const APP_URL = (import.meta.env.VITE_APP_URL ?? '').trim().replace(/\/+$/, '')

export const WALLETCONNECT_ID = 'walletconnect'

/** True when a project id was configured at build time. */
export const walletConnectConfigured = () => PROJECT_ID.length > 0

/**
 * Chains offered to the wallet, Robinhood Chain first — it is the one the
 * launchpad needs. All are optional: a required chain a wallet does not support
 * makes it refuse the whole connection, and MESH would rather connect and then
 * ask to switch, which is a prompt the user can act on.
 */
const chainIds = [robinhoodChain.id, ...KNOWN_CHAINS.map((c) => c.id).filter((id) => id !== robinhoodChain.id)]

const rpcMap = Object.fromEntries(
  KNOWN_CHAINS.map((c) => [String(c.id), c.rpcUrls.default.http[0]]).filter(([, url]) => !!url),
)

/** The class is exported as a value, so the instance type comes from it. */
type WcProvider = InstanceType<typeof EthereumProviderClass>

let instance: WcProvider | null = null
let initialising: Promise<WcProvider> | null = null

async function init(): Promise<WcProvider> {
  if (instance) return instance
  if (initialising) return initialising

  initialising = (async () => {
    // Imported here rather than at module scope: it pulls in the relay client
    // and the Reown modal, and a browser-wallet user should never pay for that
    // download. Nothing loads until someone picks WalletConnect.
    const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
    const provider = await EthereumProvider.init({
      projectId: PROJECT_ID,
      optionalChains: chainIds as [number, ...number[]],
      rpcMap,
      showQrModal: true,
      metadata: {
        name: 'MESH',
        description: 'Your Identity. Your Network. Your Value.',
        // Must be a domain registered under Project Domains on the Reown
        // project, or the wallet reports the connection as unverified.
        url: APP_URL || window.location.origin,
        icons: [`${APP_URL || window.location.origin}/favicon.ico`],
      },
    })
    instance = provider
    // Listeners queued before the provider existed are attached now, so the
    // account and chain the app is watching are the ones this session reports.
    for (const [event, listener] of pending) provider.on(event as 'accountsChanged', listener)
    pending.length = 0
    return provider
  })()

  try {
    return await initialising
  } finally {
    initialising = null
  }
}

type Listener = (...args: unknown[]) => void
const pending: Array<[string, Listener]> = []

/**
 * An EIP-1193 façade over a provider that does not exist yet.
 *
 * `WalletOption` hands the app a provider synchronously, but Reown's is built
 * asynchronously and opening its relay connection on page load — for everyone,
 * including people who use MetaMask — would be rude. So the real provider is
 * built on first use, and this stands in until then.
 */
const facade = {
  async request(args: { method: string; params?: unknown }) {
    const provider = await init()

    // `enable()` is the call that opens the QR modal and waits for the wallet.
    // Asking for accounts before a session exists would otherwise just fail.
    if (args.method === 'eth_requestAccounts') {
      if (!provider.session) return provider.enable()
      return provider.accounts
    }
    // Used on boot to check for a session without prompting: answer from the
    // restored session rather than reaching for the wallet.
    if (args.method === 'eth_accounts') return provider.session ? provider.accounts : []
    if (args.method === 'eth_chainId' && provider.session) return `0x${provider.chainId.toString(16)}`

    return provider.request(args as Parameters<WcProvider['request']>[0])
  },

  on(event: string, listener: Listener) {
    if (instance) instance.on(event as 'accountsChanged', listener)
    else pending.push([event, listener])
  },

  removeListener(event: string, listener: Listener) {
    if (instance) instance.removeListener(event as 'accountsChanged', listener)
    else {
      const i = pending.findIndex(([e, l]) => e === event && l === listener)
      if (i >= 0) pending.splice(i, 1)
    }
  },
} as unknown as EIP1193Provider

/**
 * Ends the WalletConnect session.
 *
 * Disconnecting in MESH has to reach the wallet too. A session left alive would
 * have the phone still listing MESH as connected, and the next visit would
 * silently resume a session the user believed they had ended.
 */
async function disconnect() {
  if (!instance) return
  try {
    if (instance.session) await instance.disconnect()
  } catch {
    /* the session is gone either way; never block the local disconnect */
  }
  instance = null
  pending.length = 0
}

/** The picker entry, or null when no project id was configured. */
export function walletConnectOption(): WalletOption | null {
  if (!walletConnectConfigured()) return null
  return {
    id: WALLETCONNECT_ID,
    name: 'WalletConnect',
    provider: facade,
    disconnect,
  }
}
