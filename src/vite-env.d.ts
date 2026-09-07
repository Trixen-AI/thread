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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
