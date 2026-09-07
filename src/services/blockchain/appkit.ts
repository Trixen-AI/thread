import type { EIP1193Provider } from 'viem'
import type { AppKit } from '@reown/appkit'
import { KNOWN_CHAINS, robinhoodChain } from './chains'
import type { WalletOption } from './wallets'

/**
 * Connecting, through Reown AppKit.
 *
 * AppKit owns the whole connect experience: it detects the extensions already
 * in the browser, lists and searches several hundred more, deep-links into a
 * phone wallet, and falls back to a QR code — all in one modal that people have
 * already met on other apps.
 *
 * MESH used to run its own picker over EIP-6963 and hand WalletConnect a QR of
 * its own. Two pickers for one decision is one too many, and ours knew about
 * only the wallets that announce themselves to the page.
 *
 * What does not change is what comes out the other end: an EIP-1193 provider,
 * which is the only thing the rest of the app has ever wanted. AppKit is the
 * way a wallet is chosen, not a second wallet layer.
 *
 * The project id is public. It identifies the app to Reown's relay and ships in
 * the bundle like any other client config; what limits its use is the domain
 * list on the Reown project, not secrecy.
 */

const PROJECT_ID = (import.meta.env.VITE_REOWN_PROJECT_ID ?? '').trim()

/**
 * The app's canonical URL, as declared to the wallet. Defaults to the live
 * origin, which is right almost always. `VITE_APP_URL` pins it to one domain —
 * set it only to a domain registered under Project Domains on the Reown
 * project, since this is a claim the wallet checks rather than takes on trust.
 */
const APP_URL = (import.meta.env.VITE_APP_URL ?? '').trim().replace(/\/+$/, '')

export const REOWN_ID = 'reown'

/** True when a project id was configured at build time. */
export const reownConfigured = () => PROJECT_ID.length > 0

/** Robinhood Chain first: it is the one the launchpad needs. */
const networks = [
  robinhoodChain,
  ...KNOWN_CHAINS.filter((c) => c.id !== robinhoodChain.id),
] as [typeof robinhoodChain, ...typeof KNOWN_CHAINS]

let modal: AppKit | null = null
let initialising: Promise<AppKit> | null = null

/**
 * Builds the modal on first use.
 *
 * AppKit and the wagmi adapter are a large download, and someone who never
 * opens the wallet sheet should not pay for it — so this is imported here
 * rather than at module scope, and the bundler splits it out.
 */
async function init(): Promise<AppKit> {
  if (modal) return modal
  if (initialising) return initialising

  initialising = (async () => {
    // The ethers adapter rather than the wagmi one: MESH does not use wagmi for
    // anything, and its dependency graph fights viem's. All this adapter is
    // asked for is the connector plumbing behind the modal — every read and
    // write in the app still goes through viem, on the EIP-1193 provider that
    // comes out the far side.
    const [{ createAppKit }, { EthersAdapter }] = await Promise.all([
      import('@reown/appkit'),
      import('@reown/appkit-adapter-ethers'),
    ])

    const url = APP_URL || window.location.origin
    const built = createAppKit({
      adapters: [new EthersAdapter()],
      networks,
      projectId: PROJECT_ID,
      metadata: {
        name: 'MESH',
        description: 'Your Identity. Your Network. Your Value.',
        url,
        icons: [`${url}/favicon.ico`],
      },
      themeMode: 'light',
      features: {
        // MESH has its own accounts; a second identity in the wallet sheet
        // would be a different login people did not ask for.
        email: false,
        socials: [],
        // Nothing here needs a swap or an on-ramp, and offering one we do not
        // support would be a dead end.
        swaps: false,
        onramp: false,
        analytics: false,
      },
    })
    modal = built
    return built
  })()

  try {
    return await initialising
  } finally {
    initialising = null
  }
}

/** Resolves once AppKit reports a connected account, or when the modal closes. */
function waitForConnection(kit: AppKit): Promise<boolean> {
  if (kit.getIsConnectedState()) return Promise.resolve(true)

  return new Promise((resolve) => {
    let settled = false
    const finish = (connected: boolean) => {
      if (settled) return
      settled = true
      unsubscribeAccount()
      unsubscribeState()
      resolve(connected)
    }

    const unsubscribeAccount = kit.subscribeAccount((account) => {
      if (account.isConnected) finish(true)
    })
    // Someone who closes the sheet has decided not to connect. Without this the
    // promise would hang and the button would spin for ever.
    const unsubscribeState = kit.subscribeState((state) => {
      if (!state.open && !kit.getIsConnectedState()) finish(false)
    })
  })
}

const walletFor = (kit: AppKit): WalletOption => ({
  id: REOWN_ID,
  name: 'Reown',
  provider: kit.getProvider<EIP1193Provider>('eip155') as EIP1193Provider,
  // Disconnecting in MESH has to reach the wallet too, or the phone keeps
  // listing MESH as connected and the next visit silently resumes.
  disconnect: async () => {
    await kit.disconnect().catch(() => {})
  },
})

export class ReownNotConfigured extends Error {
  constructor() {
    super('WalletConnect is not configured. Set VITE_REOWN_PROJECT_ID and rebuild.')
    this.name = 'ReownNotConfigured'
  }
}

export class ReownDismissed extends Error {
  constructor() {
    super('Connection cancelled')
    this.name = 'ReownDismissed'
  }
}

/**
 * Opens the modal and resolves with the chosen wallet once it is connected.
 * Rejects with `ReownDismissed` when the sheet is closed without connecting,
 * which callers treat as a cancellation rather than a failure.
 */
export async function connectWithReown(): Promise<WalletOption> {
  if (!reownConfigured()) throw new ReownNotConfigured()
  const kit = await init()

  if (!kit.getIsConnectedState()) {
    await kit.open()
    const connected = await waitForConnection(kit)
    if (!connected) throw new ReownDismissed()
  }

  const wallet = walletFor(kit)
  if (!wallet.provider) throw new Error('The wallet connected but returned no provider.')
  return wallet
}

/**
 * The wallet from a session AppKit restored on its own, or null. Used on boot
 * so a reload does not drop the connection — and never opens the modal.
 */
export async function restoreReown(): Promise<WalletOption | null> {
  if (!reownConfigured()) return null
  const kit = await init()
  // AppKit rehydrates asynchronously, so a check on the same tick can miss.
  if (!kit.getIsConnectedState()) {
    const connected = await Promise.race([
      new Promise<boolean>((resolve) => {
        const stop = kit.subscribeAccount((a) => {
          if (a.isConnected) {
            stop()
            resolve(true)
          }
        })
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500)),
    ])
    if (!connected) return null
  }
  const wallet = walletFor(kit)
  return wallet.provider ? wallet : null
}

/** Opens AppKit's own account sheet — networks, balance, disconnect. */
export async function openReownAccount() {
  const kit = await init()
  await kit.open()
}
