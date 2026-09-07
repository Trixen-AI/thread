import { Link } from 'react-router-dom'
import { ChevronRight, Wallet } from 'lucide-react'
import { shortAddress, tokenAmount, usd } from '@/lib/utils'
import { useApp } from '@/store/appStore'
import { openWalletPicker } from './ConnectWallet'
import { WalletService } from '@/services/blockchain'
import { LogoTile } from '@/components/brand/Logo'
import { Spinner } from '@/components/ui/Feedback'

/**
 * The wallet as it appears in the left rail: an identity card, not a
 * "Connect Wallet" button. Address is truncated; the full value lives on the
 * wallet page behind an explicit reveal.
 */
export function WalletMiniCard() {
  const { wallet } = useApp()

  if (wallet.status !== 'connected') {
    return (
      <button
        onClick={openWalletPicker}
        disabled={wallet.status === 'connecting'}
        className="mesh-card flex w-full items-center gap-3 p-3 text-left transition-shadow hover:shadow-[var(--shadow-raise)] disabled:opacity-70"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          {wallet.status === 'connecting' ? <Spinner className="size-4" /> : <Wallet className="size-[18px]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-ink-900">
            {wallet.status === 'connecting' ? 'Connecting…' : 'Connect wallet'}
          </span>
          <span className="block truncate text-[12px] text-ink-500">
            {wallet.status === 'error' ? wallet.error : 'Add ownership to your profile'}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-400" />
      </button>
    )
  }

  const total = WalletService.totalValue(wallet.balances)
  // Without a price feed there is no dollar figure to show, so the headline
  // falls back to the largest holding rather than inventing one.
  const headline = wallet.balances[0]

  return (
    <Link
      to="/wallet"
      className="mesh-card flex items-center gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-raise)]"
    >
      <LogoTile rounded="rounded-full" className="size-9 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold leading-tight text-ink-900">Wallet</span>
        <span className="block truncate font-mono text-[11px] leading-tight text-ink-500">
          {shortAddress(wallet.account!.address)}
        </span>
        <span className="mt-0.5 block text-[13px] font-bold leading-tight text-ink-900">
          {total !== null
            ? usd(total)
            : headline
              ? `${tokenAmount(headline.amount, headline.symbol)} ${headline.symbol}`
              : '—'}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 self-center text-ink-400" />
    </Link>
  )
}
