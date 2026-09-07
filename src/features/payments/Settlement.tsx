import { CheckCircle2, ExternalLink, Info, ShieldAlert } from 'lucide-react'
import type { TransferReceipt } from '@/types'
import { PaymentService } from '@/services/blockchain'
import { useApp } from '@/store/appStore'

/**
 * How a completed payment is described.
 *
 * The demo provider never produces a transaction, so nothing here claims one.
 * When a real provider is wired up the same component reports the hash.
 */
export function SettlementNote({ receipt }: { receipt: TransferReceipt }) {
  const info = PaymentService.describeSettlement(receipt)

  return (
    <div
      className={`flex items-start gap-2.5 rounded-2xl px-3.5 py-3 ${
        info.demo ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'
      }`}
    >
      {info.demo ? (
        <ShieldAlert className="mt-0.5 size-[18px] shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-[18px] shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[13px] font-bold">{info.title}</p>
        <p className="mt-0.5 text-[12.5px] leading-snug opacity-90">{info.detail}</p>
        {receipt.settlement.kind === 'demo' ? (
          <p className="mt-1 font-mono text-[11px] opacity-70">
            ref {receipt.settlement.reference}
          </p>
        ) : receipt.settlement.explorerUrl ? (
          <a
            href={receipt.settlement.explorerUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold underline underline-offset-2"
          >
            View on the block explorer
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <p className="mt-1 break-all font-mono text-[11px] opacity-70">
            {receipt.settlement.hash}
          </p>
        )}
      </div>
    </div>
  )
}

/** Inline banner shown before a payment, whenever the demo provider is active. */
export function DemoNotice({ className }: { className?: string }) {
  const { wallet } = useApp()
  if (!wallet.isDemo) return null

  return (
    <div
      className={`flex items-start gap-2.5 rounded-[16px] bg-ink-700/8 px-3.5 py-2.5 text-ink-600 ${className ?? ''}`}
    >
      <Info className="mt-0.5 size-4 shrink-0" />
      <p className="text-[12.5px] leading-snug">
        Demo mode — balances are local and no blockchain transaction is created.
      </p>
    </div>
  )
}
