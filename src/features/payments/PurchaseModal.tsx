import { useEffect, useState } from 'react'
import { ShoppingBag, Wallet } from 'lucide-react'
import { compact, tokenAmount } from '@/lib/utils'
import type { TransferReceipt, TxPhase } from '@/types'
import { selectBalance, selectUser, setUi, useApp } from '@/store/appStore'
import { buyMarketplaceItem, toast } from '@/store/actions'
import { openWalletPicker } from '@/features/wallet/ConnectWalletModal'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Scene } from '@/components/social/Scene'
import { TokenIcon } from '@/features/wallet/TokenIcon'
import { DemoNotice, SettlementNote } from './Settlement'

export function PurchaseModal() {
  const state = useApp()
  const itemId = state.ui.buyItemId
  const [phase, setPhase] = useState<TxPhase>('idle')
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (itemId) {
      setPhase('idle')
      setReceipt(null)
      setError(undefined)
    }
  }, [itemId])

  const item = state.marketplace.find((i) => i.id === itemId)
  if (!item) return null

  const creator = selectUser(state, item.creatorId)
  const balance = selectBalance(state, item.asset)
  const connected = state.wallet.status === 'connected'
  const free = item.price === 0
  const insufficient = connected && !free && !!balance && item.price > balance.amount

  const close = () => setUi({ buyItemId: null })

  const confirm = async () => {
    setPhase('pending')
    const result = await buyMarketplaceItem(item.id)
    if (result.receipt) {
      setReceipt(result.receipt)
      setPhase('success')
      toast({ title: `${item.title} acquired`, tone: 'success', icon: 'coins' })
    } else {
      setPhase('error')
      setError(result.error)
    }
  }

  return (
    <Modal
      open={!!itemId}
      onClose={close}
      title={phase === 'success' ? 'Purchase complete' : item.title}
      description={phase === 'success' ? undefined : item.subtitle}
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
            Connect wallet to continue
          </Button>
        ) : (
          <Button
            block
            loading={phase === 'pending'}
            disabled={insufficient || item.soldOut}
            icon={<ShoppingBag className="size-[18px]" />}
            onClick={() => void confirm()}
          >
            {item.soldOut
              ? 'Sold out'
              : insufficient
                ? `Not enough ${item.asset}`
                : free
                  ? 'Claim for free'
                  : `Buy · ${tokenAmount(item.price, item.asset)} ${item.asset}`}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <Scene kind={item.scene} tone={item.tone} className="aspect-[16/9]" />

        {phase === 'success' && receipt ? (
          <SettlementNote receipt={receipt} />
        ) : (
          <>
            <div className="flex items-center gap-2.5 panel-inset p-3">
              <Avatar seed={creator.avatar} size="sm" name={creator.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink-900">{creator.name}</p>
                <p className="truncate text-[12px] text-ink-500">Creator</p>
              </div>
              <span className="text-[12.5px] font-semibold text-ink-600">
                {compact(item.metricValue)} {item.metricLabel}
              </span>
            </div>

            <div className="flex items-center justify-between panel p-3.5">
              <span className="text-[13px] text-ink-500">Price</span>
              <span className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em] text-ink-900">
                {!free && <TokenIcon symbol={item.asset} size="sm" />}
                {free ? 'Free' : `${tokenAmount(item.price, item.asset)} ${item.asset}`}
              </span>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-medium text-danger">
                {error}
              </p>
            )}

            <DemoNotice />
          </>
        )}
      </div>
    </Modal>
  )
}
