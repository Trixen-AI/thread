import { useState } from 'react'
import { Check, LogOut, Mail, ShoppingBag, Star, Wallet, X } from 'lucide-react'
import { cn, compact, tokenAmount } from '@/lib/utils'
import type { TransferReceipt } from '@/types'
import { isMember, selectCommunity, setUi, useApp } from '@/store/appStore'
import {
  checkAccess,
  joinCommunity,
  leaveCommunity,
  payForCommunity,
  toast,
} from '@/store/actions'
import { openWalletPicker } from '@/features/wallet/ConnectWallet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { AccessBadge } from '@/components/ui/Badge'
import { SettlementNote } from '@/features/payments/Settlement'

/**
 * The access gate. When a requirement is not met, this explains which one and
 * what would satisfy it — conditions are OR'd, so any single row unlocks entry.
 */
export function AccessModal() {
  const state = useApp()
  const communityId = state.ui.joinCommunityId
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null)

  const community = communityId ? selectCommunity(state, communityId) : undefined
  if (!community) return null

  const joined = isMember(state, community.id)
  const access = checkAccess(community)
  const paid = community.access.anyOf.find((c) => c.kind === 'paid')

  // An unmet holding requirement is only useful if the user can act on it —
  // find the marketplace listing that would satisfy the gate.
  const unmet = access.conditions.find((c) => !c.met)?.condition
  const holding =
    unmet && (unmet.kind === 'nft' || unmet.kind === 'token') ? unmet : undefined
  const remedyItem = holding
    ? state.marketplace.find((item) =>
        holding.kind === 'nft'
          ? item.collectionId === holding.collectionId
          : item.title.toLowerCase().includes(holding.symbol.toLowerCase()),
      )
    : undefined

  const close = () => {
    setUi({ joinCommunityId: null })
    setReceipt(null)
  }

  const primaryAction = () => {
    if (joined) return null
    if (access.granted) {
      return (
        <Button
          block
          onClick={() => {
            joinCommunity(community.id)
            close()
          }}
        >
          Join {community.name}
        </Button>
      )
    }
    switch (access.remedy) {
      case 'connect-wallet':
      case 'acquire-token':
      case 'acquire-nft':
        if (state.wallet.status !== 'connected') {
          return (
            <Button
              block
              icon={<Wallet className="size-[18px]" />}
              loading={state.wallet.status === 'connecting'}
              onClick={openWalletPicker}
            >
              Connect wallet to check
            </Button>
          )
        }
        return remedyItem ? (
          <Button
            block
            icon={<ShoppingBag className="size-[18px]" />}
            onClick={() => setUi({ joinCommunityId: null, buyItemId: remedyItem.id })}
          >
            Get {remedyItem.title} ·{' '}
            {remedyItem.price === 0
              ? 'Free'
              : `${tokenAmount(remedyItem.price, remedyItem.asset)} ${remedyItem.asset}`}
          </Button>
        ) : (
          <Button block variant="secondary" onClick={close}>
            Requirement not met
          </Button>
        )
      case 'purchase':
        return (
          <Button
            block
            loading={busy}
            onClick={async () => {
              setBusy(true)
              const result = await payForCommunity(community.id)
              setBusy(false)
              if (result.receipt) setReceipt(result.receipt)
              else if (result.error) toast({ title: result.error, tone: 'error', icon: 'alert' })
            }}
          >
            {paid?.kind === 'paid'
              ? `Join · ${tokenAmount(paid.price, paid.asset)} ${paid.asset}`
              : 'Join'}
          </Button>
        )
      case 'request-invite':
        return (
          <Button
            block
            variant="secondary"
            icon={<Mail className="size-[18px]" />}
            onClick={() => {
              toast({
                title: 'Invite requested',
                description: `Moderators of ${community.name} will review it.`,
                tone: 'default',
                icon: 'check',
              })
              close()
            }}
          >
            Request an invite
          </Button>
        )
      case 'build-reputation':
        return (
          <Button block variant="secondary" icon={<Star className="size-[18px]" />} disabled>
            Keep contributing to unlock
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <Modal
      open={!!communityId}
      onClose={close}
      title={joined ? community.name : `Join ${community.name}`}
      description={joined ? 'You are a member of this community.' : community.description}
      footer={
        receipt ? (
          <Button block onClick={close}>
            Done
          </Button>
        ) : joined ? (
          <Button
            block
            variant="danger"
            icon={<LogOut className="size-[18px]" />}
            onClick={() => {
              leaveCommunity(community.id)
              close()
            }}
          >
            Leave community
          </Button>
        ) : (
          primaryAction()
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar seed={community.avatar} size="xl" square name={community.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-ink-900">{community.name}</p>
            <p className="text-[12.5px] text-ink-500">
              {compact(community.members)} members · {community.category}
            </p>
            <AccessBadge kind={community.access.label} className="mt-1.5" />
          </div>
        </div>

        {receipt ? (
          <SettlementNote receipt={receipt} />
        ) : (
          <>
            <div>
              <p className="pb-2 text-[13px] font-semibold text-ink-700">
                {community.access.label === 'free'
                  ? 'Access'
                  : 'Access requirements — meet any one'}
              </p>
              <ul className="space-y-1.5">
                {access.conditions.map((row, i) => (
                  <li
                    key={i}
                    className={cn(
                      'flex items-start gap-2.5 rounded-xl border px-3 py-2.5',
                      row.met
                        ? 'bg-success/10 shadow-[inset_0_0_0_0.5px_rgb(52_199_89/0.4)]'
                        : 'shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.12)]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                        row.met ? 'bg-success text-white' : 'bg-ink-700/14 text-ink-500',
                      )}
                    >
                      {row.met ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : (
                        <X className="size-3" strokeWidth={3} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-ink-900">
                        {row.label}
                      </span>
                      <span className="block text-[12px] text-ink-500">{row.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {community.credential && (
              <div className="rounded-[16px] bg-brand-600/10 px-3.5 py-3">
                <p className="text-[13px] font-bold text-brand-800">
                  {community.credential.name}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-brand-700/80">
                  Members receive a membership credential. While MESH runs on the demo provider it
                  is held in your MESH account; a live deployment issues it to your wallet.
                </p>
              </div>
            )}

            {community.rules.length > 0 && (
              <div>
                <p className="pb-1.5 text-[13px] font-semibold text-ink-700">Community rules</p>
                <ol className="space-y-1">
                  {community.rules.map((rule, i) => (
                    <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-ink-600">
                      <span className="font-bold text-ink-400">{i + 1}.</span>
                      {rule}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
