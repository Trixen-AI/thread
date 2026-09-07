import { useEffect, useState } from 'react'
import { ArrowLeftRight, Check, Copy, Plus, Send } from 'lucide-react'
import { cn, tokenAmount, usd } from '@/lib/utils'
import type { TokenSymbol, TransferReceipt, TxPhase } from '@/types'
import { selectBalance, setUi, useApp } from '@/store/appStore'
import { creditDemoWallet, sendTokens, toast } from '@/store/actions'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { TokenIcon } from './TokenIcon'
import { DemoNotice, SettlementNote } from '@/features/payments/Settlement'

const ASSETS: TokenSymbol[] = ['ETH', 'USDC', 'MESH', 'RHB']

export function WalletSheets() {
  const { ui } = useApp()
  const close = () => setUi({ walletSheet: null })

  return (
    <>
      <SendSheet open={ui.walletSheet === 'send'} onClose={close} />
      <ReceiveSheet open={ui.walletSheet === 'receive'} onClose={close} />
      <BuySheet open={ui.walletSheet === 'buy'} onClose={close} />
      <SwapSheet open={ui.walletSheet === 'swap'} onClose={close} />
    </>
  )
}

function AssetPicker({
  value,
  onChange,
}: {
  value: TokenSymbol
  onChange: (next: TokenSymbol) => void
}) {
  const state = useApp()
  return (
    <div className="grid grid-cols-4 gap-2">
      {ASSETS.map((symbol) => {
        const balance = selectBalance(state, symbol)
        return (
          <button
            key={symbol}
            onClick={() => onChange(symbol)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-colors',
              value === symbol
                ? 'border-brand-400 bg-brand-50'
                : 'shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.12)] hover:bg-ink-700/[0.05]',
            )}
          >
            <TokenIcon symbol={symbol} size="sm" />
            <span className="text-[12px] font-bold text-ink-900">{symbol}</span>
            <span className="text-[10.5px] text-ink-500">
              {balance ? tokenAmount(balance.amount, symbol) : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useApp()
  const [asset, setAsset] = useState<TokenSymbol>('USDC')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [memo, setMemo] = useState('')
  const [phase, setPhase] = useState<TxPhase>('idle')
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (open) {
      setAmount('')
      setRecipient('')
      setMemo('')
      setPhase('idle')
      setReceipt(null)
      setError(undefined)
    }
  }, [open])

  const balance = selectBalance(state, asset)
  const value = Number(amount)
  const insufficient = !!balance && value > balance.amount
  const valid = value > 0 && !insufficient && recipient.trim().length > 1

  const confirm = async () => {
    setPhase('pending')
    const handle = recipient.trim().replace(/^@/, '')
    const match = state.users.find((u) => u.handle.toLowerCase() === handle.toLowerCase())
    const result = await sendTokens(
      match ? `@${match.handle}` : recipient.trim(),
      match ? `mesh:@${match.handle}` : recipient.trim(),
      value,
      asset,
      memo.trim() || undefined,
    )
    if (result.receipt) {
      setReceipt(result.receipt)
      setPhase('success')
      toast({ title: 'Transfer complete', tone: 'success', icon: 'coins' })
    } else {
      setPhase('error')
      setError(result.error)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={phase === 'success' ? 'Sent' : 'Send'}
      description={phase === 'success' ? undefined : 'Send to a MESH handle or an address'}
      footer={
        phase === 'success' ? (
          <Button block onClick={onClose}>
            Done
          </Button>
        ) : (
          <Button
            block
            loading={phase === 'pending'}
            disabled={!valid}
            icon={<Send className="size-[18px]" />}
            onClick={() => void confirm()}
          >
            {insufficient ? `Not enough ${asset}` : 'Send'}
          </Button>
        )
      }
    >
      {phase === 'success' && receipt ? (
        <div className="space-y-4">
          <div className="panel p-4 text-center">
            <p className="text-[32px] font-bold tracking-[-0.035em] text-ink-900">
              {tokenAmount(receipt.amount, receipt.asset)} {receipt.asset}
            </p>
            <p className="mt-1 text-[13px] text-ink-500">to {receipt.counterparty}</p>
          </div>
          <SettlementNote receipt={receipt} />
        </div>
      ) : (
        <div className="space-y-4">
          <AssetPicker value={asset} onChange={setAsset} />

          <div>
            <p className="pb-1.5 text-[13px] font-semibold text-ink-700">To</p>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="@handle or 0x…"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between pb-1.5">
              <span className="text-[13px] font-semibold text-ink-700">Amount</span>
              <button
                onClick={() => balance && setAmount(String(balance.amount))}
                className="text-[12px] font-semibold text-brand-600 hover:text-brand-700"
              >
                Max {balance ? tokenAmount(balance.amount, asset) : '0'}
              </button>
            </div>
            <Input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              trailing={<span className="text-[13px] font-bold text-ink-500">{asset}</span>}
            />
            {balance?.usdPrice != null && value > 0 && (
              <p className="pt-1 text-[12px] text-ink-500">≈ {usd(value * balance.usdPrice)}</p>
            )}
          </div>

          <div>
            <p className="pb-1.5 text-[13px] font-semibold text-ink-700">Note (optional)</p>
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this for?" />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-medium text-danger">
              {error}
            </p>
          )}

          <DemoNotice />
        </div>
      )}
    </Modal>
  )
}

function ReceiveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useApp()
  const [copied, setCopied] = useState(false)
  const address = state.wallet.account?.address ?? ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast({ title: 'Could not copy address', tone: 'error', icon: 'alert' })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Receive" description="Share your address or handle">
      <div className="space-y-4">
        <div className="panel p-4 text-center">
          <p className="text-[13px] text-ink-500">Your MESH handle</p>
          <p className="mt-1 text-[25px] font-bold tracking-[-0.032em] text-ink-900">
            @{state.me?.handle}
          </p>
          <p className="mt-3 text-[13px] text-ink-500">Wallet address</p>
          <p className="mt-1 break-all font-mono text-[12.5px] text-ink-700">{address}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            onClick={() => void copy()}
          >
            {copied ? 'Copied' : 'Copy address'}
          </Button>
        </div>
        <DemoNotice />
      </div>
    </Modal>
  )
}

function BuySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [asset, setAsset] = useState<TokenSymbol>('USDC')
  const [amount, setAmount] = useState('50')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buy"
      description="Top up your balance"
      footer={
        <Button
          block
          icon={<Plus className="size-[18px]" />}
          disabled={!Number(amount)}
          onClick={() => {
            creditDemoWallet(asset, Number(amount))
            toast({
              title: `Added ${amount} ${asset}`,
              description: 'Demo balance only — no purchase was made.',
              tone: 'default',
              icon: 'wallet',
            })
            onClose()
          }}
        >
          Add {amount || '0'} {asset} (demo)
        </Button>
      }
    >
      <div className="space-y-4">
        <AssetPicker value={asset} onChange={setAsset} />
        <div>
          <p className="pb-1.5 text-[13px] font-semibold text-ink-700">Amount</p>
          <Input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            trailing={<span className="text-[13px] font-bold text-ink-500">{asset}</span>}
          />
        </div>
        <div className="rounded-2xl bg-amber-50 px-3.5 py-3 text-[12.5px] leading-snug text-amber-900">
          <strong className="font-bold">No payment provider is connected.</strong> This adds a
          balance to the local demo wallet so you can try the payment flows. Nothing is purchased
          and no money moves.
        </div>
      </div>
    </Modal>
  )
}

function SwapSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useApp()
  const [from, setFrom] = useState<TokenSymbol>('USDC')
  const [to, setTo] = useState<TokenSymbol>('MESH')
  const [amount, setAmount] = useState('')

  const fromBalance = selectBalance(state, from)
  const toBalance = selectBalance(state, to)
  // Only meaningful when both sides have a price; otherwise there is no rate.
  const rate =
    fromBalance?.usdPrice != null && toBalance?.usdPrice
      ? fromBalance.usdPrice / toBalance.usdPrice
      : 0
  const output = Number(amount) * rate

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Swap"
      description="Exchange one asset for another"
      footer={
        <Button
          block
          disabled
          icon={<ArrowLeftRight className="size-[18px]" />}
        >
          Swap unavailable in demo
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="panel p-3.5">
          <p className="pb-2 text-[12.5px] font-semibold text-ink-500">From</p>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="border-0 px-0 text-[22px] font-bold focus:ring-0"
            />
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value as TokenSymbol)}
              className="h-10 shrink-0 rounded-[10px] bg-ink-700/8 px-3 text-[13.5px] font-bold text-ink-800"
            >
              {ASSETS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <p className="pt-1 text-[12px] text-ink-500">
            Balance {fromBalance ? tokenAmount(fromBalance.amount, from) : '0'}
          </p>
        </div>

        <div className="flex justify-center">
          <span className="flex size-9 items-center justify-center panel-sm rounded-full bg-white text-ink-500">
            <ArrowLeftRight className="size-4 rotate-90" />
          </span>
        </div>

        <div className="panel p-3.5">
          <p className="pb-2 text-[12.5px] font-semibold text-ink-500">To</p>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[22px] font-bold text-ink-900">
              {output ? tokenAmount(output, to) : '0.00'}
            </span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value as TokenSymbol)}
              className="h-10 shrink-0 rounded-[10px] bg-ink-700/8 px-3 text-[13.5px] font-bold text-ink-800"
            >
              {ASSETS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-[16px] bg-ink-700/8 px-3.5 py-3 text-[12.5px] leading-snug text-ink-600">
          Swapping needs a liquidity provider. None is configured, so this screen shows the
          interface only — the button stays disabled rather than pretending to trade.
        </div>
      </div>
    </Modal>
  )
}
