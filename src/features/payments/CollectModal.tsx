import { useEffect, useState } from 'react'
import { Sparkles, Wallet } from 'lucide-react'
import { compact, tokenAmount } from '@/lib/utils'
import type { TransferReceipt, TxPhase } from '@/types'
import { selectBalance, selectPost, selectUser, setUi, useApp } from '@/store/appStore'
import { collectPost, toast } from '@/store/actions'
import { openWalletPicker } from '@/features/wallet/ConnectWallet'
import { CollectibleService } from '@/services/blockchain'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Scene } from '@/components/social/Scene'
import { TokenIcon } from '@/features/wallet/TokenIcon'
import { DemoNotice, SettlementNote } from './Settlement'

export function CollectModal() {
  const state = useApp()
  const postId = state.ui.collectPostId
  const [phase, setPhase] = useState<TxPhase>('idle')
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (postId) {
      setPhase('idle')
      setReceipt(null)
      setError(undefined)
    }
  }, [postId])

  const post = postId ? selectPost(state, postId) : undefined
  if (!post?.collectible) return null

  const author = selectUser(state, post.authorId)
  const quote = CollectibleService.quote(post.collectible.price, post.collectible.asset)
  const balance = selectBalance(state, quote.asset)
  const connected = state.wallet.status === 'connected'
  const insufficient = connected && !!balance && quote.price > balance.amount

  const close = () => setUi({ collectPostId: null })

  const confirm = async () => {
    setPhase('pending')
    const result = await collectPost(post.id)
    if (result.receipt) {
      setReceipt(result.receipt)
      setPhase('success')
      toast({
        title: 'Collected',
        description: `You now hold this post by @${author.handle}.`,
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
      open={!!postId}
      onClose={close}
      title={phase === 'success' ? 'Collected' : 'Collect this post'}
      description={phase === 'success' ? undefined : `By @${author.handle}`}
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
            Connect wallet to collect
          </Button>
        ) : (
          <Button
            block
            loading={phase === 'pending'}
            disabled={insufficient}
            icon={<Sparkles className="size-[18px]" />}
            onClick={() => void confirm()}
          >
            {insufficient
              ? `Not enough ${quote.asset}`
              : `Collect · ${tokenAmount(quote.price, quote.asset)} ${quote.asset}`}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="overflow-hidden panel">
          {post.media &&
            (post.media.src ? (
              <img src={post.media.src} alt="" className="aspect-[16/9] w-full object-cover" />
            ) : (
              <Scene
                kind={post.media.scene}
                tone={post.media.tone}
                rounded="rounded-none"
                className="aspect-[16/9]"
              />
            ))}
          <div className="flex items-start gap-2.5 p-3">
            <Avatar seed={author.avatar} size="sm" name={author.name} />
            <p className="line-clamp-3 flex-1 text-[13px] leading-snug text-ink-700">
              {post.text}
            </p>
          </div>
        </div>

        {phase === 'success' && receipt ? (
          <SettlementNote receipt={receipt} />
        ) : (
          <>
            <div className="space-y-2 panel p-3.5">
              <Row label="Price">
                <span className="flex items-center gap-1.5 font-bold text-ink-900">
                  <TokenIcon symbol={quote.asset} size="sm" />
                  {tokenAmount(quote.price, quote.asset)} {quote.asset}
                </span>
              </Row>
              <Row label="To creator (95%)">
                <span className="font-semibold text-ink-700">
                  {tokenAmount(quote.toCreator, quote.asset)} {quote.asset}
                </span>
              </Row>
              <Row label="Protocol fee (5%)">
                <span className="font-semibold text-ink-700">
                  {tokenAmount(quote.fee, quote.asset)} {quote.asset}
                </span>
              </Row>
              <div className="hairline-t pt-2">
                <Row label="Collectors">
                  <span className="font-semibold text-ink-700">
                    {compact(post.collectible.collectors)}
                    {post.collectible.edition
                      ? ` of ${compact(post.collectible.edition)}`
                      : ' · open edition'}
                  </span>
                </Row>
              </div>
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

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between text-[13px]">
    <span className="text-ink-500">{label}</span>
    {children}
  </div>
)
