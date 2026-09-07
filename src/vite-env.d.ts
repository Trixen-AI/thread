/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Reown (formerly WalletConnect) project id, from https://dashboard.reown.com.
   *
   * Public by design — it identifies the app to Reown's relay and is visible in
   * any browser that loads the page, which is why access is restricted by the
   * allowed-domains list on the project rather than by keeping this secret.
   * Without it, MESH simply does not offer WalletConnect and says so; browser
   * wallets keep working.
   */
  readonly VITE_REOWN_PROJECT_ID?: string

  /**
   * Origin of the MESH API, e.g. `https://mesh-api.onrender.com`. Leave unset
   * for a same-origin deployment; the dev server proxies `/api` and `/ws`.
   */
  readonly VITE_API_URL?: string

  /**
   * The app's canonical URL, e.g. `https://meshsocial.com`, declared to wallets
   * when connecting. Defaults to whatever origin the page is served from. Set
   * it only to a domain registered under Project Domains on the Reown project.
   */
  readonly VITE_APP_URL?: string

  /**
   * Gateway used to display `ipfs://` images, with a trailing slash.
   * Defaults to Pinata's public gateway.
   */
  readonly VITE_IPFS_GATEWAY?: string

  /**
   * Alchemy API key for Robinhood Chain. Builds the endpoint
   * `https://robinhood-mainnet.g.alchemy.com/v2/<key>`.
   *
   * Read by the browser, so it ships in the bundle and is visible to anyone —
   * restrict it to your domains in the Alchemy dashboard. Unset, MESH falls
   * back to the chain's public RPC.
   */
  readonly VITE_ALCHEMY_API_KEY?: string

  /** A full RPC URL for Robinhood Chain. Wins over VITE_ALCHEMY_API_KEY. */
  readonly VITE_RPC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
