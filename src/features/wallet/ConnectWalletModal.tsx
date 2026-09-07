import { useEffect, useState } from 'react'
import { ChevronRight, Download, FlaskConical, QrCode, Wallet as WalletIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getState, setUi, useApp } from '@/store/appStore'
import { connectWallet } from '@/store/actions'
import {
  subscribeWallets,
  walletConnectConfigured,
  walletConnectOption,
  type WalletOption,
} from '@/services/blockchain'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

/**
 * Wallet picker.
 *
 * Lists every wallet that announced itself over EIP-6963, then WalletConnect
 * for wallets that live on a phone, then the local demo provider as an explicit
 * choice — so trying the payment flows never requires installing anything, and
 * using a real wallet is never accidental.
 */
export function ConnectWalletModal() {
  const state = useApp()
  const open = state.ui.walletSheet === 'connect'
  const [wallets, setWallets] = useState<WalletOption[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeWallets(setWallets)
    return () => {
      unsubscribe()
    }
  }, [])

  const close = () => setUi({ walletSheet: null })

  const pick = async (wallet: WalletOption) => {
    setBusy(wallet.id)
    await connectWallet({ wallet })
    setBusy(null)
    // Read the store directly: `state` here is the render-time snapshot and
    // would still say "connecting" at this point.
    if (getState().wallet.status === 'connected') close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Connect a wallet"
      description="MESH never sees your keys. Every signature happens in your wallet."
    >
      <div className="space-y-2">
        {wallets.map((wallet) => (
          <button
            key={wallet.id}
            onClick={() => void pick(wallet)}
            disabled={!!busy}
            className={cn(
              'panel flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors',
              'hover:bg-ink-700/[0.05] disabled:opacity-60',
            )}
          >
            {wallet.icon ? (
              <img src={wallet.icon} alt="" className="size-9 rounded-[10px]" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-600/12 text-brand-600">
                <WalletIcon className="size-[18px]" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold text-ink-900">{wallet.name}</span>
              <span className="block text-[12px] text-ink-500">Installed in this browser</span>
            </span>
            {busy === wallet.id ? (
              <span className="text-[12.5px] font-semibold text-ink-500">Connecting…</span>
            ) : (
              <ChevronRight className="size-4 text-ink-400" />
            )}
          </button>
        ))}

        {/* A phone wallet never announces itself to the page, so it gets its own
            row rather than being absent from a list of "installed" wallets. */}
        {walletConnectConfigured() ? (
          <button
            onClick={() => {
              const wc = walletConnectOption()
              if (wc) void pick(wc)
            }}
            disabled={!!busy}
            className={cn(
              'panel flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors',
              'hover:bg-ink-700/[0.05] disabled:opacity-60',
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#3396ff]/14 text-[#3396ff]">
              <QrCode className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold text-ink-900">WalletConnect</span>
              <span className="block text-[12px] text-ink-500">Scan a QR code with a wallet on your phone</span>
            </span>
            {busy === 'walletconnect' ? (
              <span className="text-[12.5px] font-semibold text-ink-500">Connecting…</span>
            ) : (
              <ChevronRight className="size-4 text-ink-400" />
            )}
          </button>
        ) : (
          <div className="panel px-3.5 py-3">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-700">
              <QrCode className="size-4 text-ink-400" />
              WalletConnect is not configured
            </p>
            <p className="mt-1 text-[12px] leading-snug text-ink-500">
              Set <code className="font-mono text-[11.5px] text-ink-700">VITE_REOWN_PROJECT_ID</code> from
              dashboard.reown.com and rebuild to connect a phone wallet.
            </p>
          </div>
        )}

        {wallets.length === 0 && (
          <div className="panel px-3.5 py-4">
            <p className="text-[14px] font-semibold text-ink-900">No browser wallet found</p>
            <p className="mt-1 text-[12.5px] leading-snug text-ink-600">
              Install an EVM wallet extension — MetaMask, Rabby, Coinbase Wallet — then reload this
              page. Or scan with a phone wallet above, or try the demo wallet below.
            </p>
            <a
              href="https://ethereum.org/en/wallets/find-wallet/"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
            >
              <Download className="size-4" />
              Find a wallet
            </a>
          </div>
        )}

        <div className="pt-1">
          <p className="px-1 pb-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-400">
            Without a wallet
          </p>
          <button
            onClick={async () => {
              setBusy('demo')
              await connectWallet({ demo: true })
              setBusy(null)
              close()
            }}
            disabled={!!busy}
            className="panel flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-ink-700/[0.05] disabled:opacity-60"
          >
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-warn/16 text-amber-600">
              <FlaskConical className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[14.5px] font-semibold text-ink-900">
                Demo wallet
                <Badge tone="warn">No blockchain</Badge>
              </span>
              <span className="block text-[12px] text-ink-500">
                In-memory balances for trying the flows
              </span>
            </span>
            <ChevronRight className="size-4 text-ink-400" />
          </button>
        </div>

        {state.wallet.status === 'error' && state.wallet.error && (
          <p className="rounded-[12px] bg-danger/12 px-3 py-2 text-[12.5px] font-medium text-danger">
            {state.wallet.error}
          </p>
        )}
      </div>
    </Modal>
  )
}

/** Opens the picker from anywhere. */
export const openWalletPicker = () => setUi({ walletSheet: 'connect' })

export function ConnectWalletButton({ block }: { block?: boolean }) {
  return (
    <Button
      block={block}
      icon={<WalletIcon className="size-[18px]" />}
      onClick={openWalletPicker}
    >
      Connect wallet
    </Button>
  )
}
