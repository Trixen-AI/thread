import { useEffect, useState } from 'react'
import { Coins, Heart, Wallet } from 'lucide-react'
import { cn, shortAddress, tokenAmount } from '@/lib/utils'
import type { TokenSymbol, TransferReceipt, TxPhase } from '@/types'
import { selectBalance, selectUser, setUi, useApp } from '@/store/appStore'
import { sendTip, toast } from '@/store/actions'
import { openWalletPicker } from '@/features/wallet/ConnectWalletModal'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Field'
import { VerifiedBadge } from '@/components/ui/Badge'
import { TokenIcon } from '@/features/wallet/TokenIcon'
import { DemoNotice, SettlementNote } from './Settlement'

const PRESETS = [1, 5, 10]
const ASSETS: TokenSymbol[] = ['USDC', 'ETH', 'MESH']

export function TipModal() {
  const state = useApp()
  const target = state.ui.tipTarget
  const [amount, setAmount] = useState<number>(5)
  const [custom, setCustom] = useState('')
  const [asset, setAsset] = useState<TokenSymbol>('USDC')
  const [phase, setPhase] = useState<TxPhase>('idle')
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (target) {
      setAmount(5)
      setCustom('')
      setAsset('USDC')
      setPhase('idle')
      setReceipt(null)
      setError(undefined)
    }
  }, [target])

  if (!target) return null

  const recipient = selectUser(state, target.userId)
  const balance = selectBalance(state, asset)
  const value = custom ? Number(custom) : amount
  const connected = state.wallet.status === 'connected'
  // On a real chain there must be an address to send to. A handle is not a
  // destination, and guessing one would send money into the void.
  const needsAddress = connected && !state.wallet.isDemo && !recipient.walletAddress
  const realMoney = connected && !state.wallet.isDemo
  const insufficient = connected && !!balance && value > balance.amount

  const close = () => setUi({ tipTarget: null })

  const confirm = async () => {
    if (!value || value <= 0) return
    setPhase('pending')
    setError(undefined)
    const result = await sendTip(target, value, asset)
    if (result.receipt) {
      setReceipt(result.receipt)
      setPhase('success')
      toast({
        title: `Tipped @${recipient.handle}`,
        description: `${tokenAmount(value, asset)} ${asset}`,
        tone: 'success',
        icon: 'coins',
      })
    } else {
      setPhase('error')
      setError(result.error)
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={close}
      title={phase === 'success' ? 'Tip sent' : `Tip @${recipient.handle}`}
      description={
        phase === 'success' ? undefined : 'Support this creator directly. They keep 100%.'
      }
      footer={
        phase === 'success' ? (
          <Button block onClick={close}>
            Done
          </Button>
        ) : !connected ? (
          <Button
            block
            icon={<Wallet className="size-[18px]" />}
            onClick={openWalletPicker}
          >
            Connect wallet to tip
          </Button>
        ) : (
          <Button
            block
            loading={phase === 'pending'}
            disabled={!value || value <= 0 || insufficient || needsAddress}
            icon={<Coins className="size-[18px]" />}
            onClick={() => void confirm()}
          >
            {needsAddress
              ? 'No wallet linked'
              : insufficient
                ? `Not enough ${asset}`
                : `Confirm tip · ${tokenAmount(value, asset)} ${asset}`}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 panel-inset p-3">
          <Avatar seed={recipient.avatar} size="lg" name={recipient.name} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[14.5px] font-bold text-ink-900">
              <span className="truncate">{recipient.name}</span>
              {recipient.verified && <VerifiedBadge />}
            </p>
            <p className="truncate text-[12.5px] text-ink-500">@{recipient.handle}</p>
          </div>
          <Heart className="size-5 text-like" />
        </div>

        {phase === 'success' && receipt ? (
          <>
            <div className="panel p-4 text-center">
              <p className="text-[32px] font-bold tracking-[-0.035em] text-ink-900">
                {tokenAmount(receipt.amount, receipt.asset)} {receipt.asset}
              </p>
              <p className="mt-1 text-[13px] text-ink-500">sent to @{recipient.handle}</p>
            </div>
            <SettlementNote receipt={receipt} />
          </>
        ) : (
          <>
            <div>
              <p className="pb-2 text-[13px] font-semibold text-ink-700">Amount</p>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setAmount(preset)
                      setCustom('')
                    }}
                    className={cn(
                      'h-11 rounded-xl text-[15px] font-bold transition-colors',
                      !custom && amount === preset
                        ? 'bg-brand-600 text-white'
                        : 'bg-ink-700/8 text-ink-700 hover:bg-ink-700/12',
                    )}
                  >
                    ${preset}
                  </button>
                ))}
                <Input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  type="number"
                  min="0"
                  placeholder="Custom"
                  className="h-11 text-center"
                />
              </div>
            </div>

            <div>
              <p className="pb-2 text-[13px] font-semibold text-ink-700">Asset</p>
              <div className="grid grid-cols-3 gap-2">
                {ASSETS.map((symbol) => {
                  const bal = selectBalance(state, symbol)
                  return (
                    <button
                      key={symbol}
                      onClick={() => setAsset(symbol)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border p-2.5 text-left transition-colors',
                        asset === symbol
                          ? 'border-brand-400 bg-brand-50'
                          : 'shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.12)] hover:bg-ink-700/[0.05]',
                      )}
                    >
                      <TokenIcon symbol={symbol} size="sm" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-ink-900">{symbol}</span>
                        <span className="block truncate text-[11px] text-ink-500">
                          {bal ? tokenAmount(bal.amount, symbol) : '—'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-medium text-danger">
                {error}
              </p>
            )}

            {needsAddress && (
              <p className="rounded-[12px] bg-warn/14 px-3.5 py-3 text-[12.5px] leading-snug text-amber-900">
                <strong className="font-semibold">@{recipient.handle} has not linked a wallet.</strong>{' '}
                They need to connect one and verify it before they can be tipped on a real network.
              </p>
            )}

            {realMoney && !needsAddress && (
              <div className="rounded-[12px] bg-brand-600/[0.08] px-3.5 py-3 text-[12.5px] leading-snug text-ink-700">
                <p className="font-semibold text-ink-900">This sends real funds.</p>
                <p className="mt-1">
                  {tokenAmount(value, asset)} {asset} on {state.wallet.account?.chainName} to{' '}
                  <span className="font-mono">{shortAddress(recipient.walletAddress ?? '')}</span>.
                  Your wallet will ask you to confirm.
                </p>
              </div>
            )}

            <DemoNotice />
          </>
        )}
      </div>
    </Modal>
  )
}
