import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initBlockchain } from '@/services/blockchain'
import { restoreWalletLink } from '@/store/actions'
import './index.css'

/**
 * Bootstrap.
 *
 * `initBlockchain()` registers the provider the whole blockchain layer talks
 * to. It defaults to the local demo provider; pass a real ChainProvider here
 * to make wallets, payments, memberships and collectibles live.
 */
initBlockchain()
restoreWalletLink()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
