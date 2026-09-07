import { Link } from 'react-router-dom'
import { ChevronRight, Rocket } from 'lucide-react'
import type { TokenAttachment } from '@/types'
import { explorerTx } from '@/services/pons'
import { TokenLogo } from './TokenBits'

/**
 * A launch, as it appears inside a post. The card is a pointer: name, symbol
 * and a way in. Price and progress live on the token page, read live from the
 * chain, rather than being frozen into the post at the moment it was written.
 */
export function TokenAttachmentCard({ token }: { token: TokenAttachment }) {
  return (
    <div className="mt-3 px-4">
      <Link
        to={`/t/${token.address}`}
        className="flex items-center gap-3 rounded-[16px] bg-brand-600/[0.08] px-3.5 py-3 shadow-[inset_0_0_0_0.5px_rgb(88_86_214/0.18)] transition-colors hover:bg-brand-600/[0.12]"
      >
        <TokenLogo logo={token.logo} symbol={token.symbol} address={token.address} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink-900">
            <span className="truncate">{token.name}</span>
            <span className="shrink-0 text-ink-500">${token.symbol}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-500">
            <Rocket className="size-3.5 text-brand-600" />
            {token.launchTx ? 'Launched on pons v2' : 'On pons v2'} · priced in {token.quoteSymbol}
            {token.launchTx && (
              <>
                {' · '}
                <a
                  href={explorerTx(token.launchTx)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-brand-600 hover:underline"
                >
                  tx
                </a>
              </>
            )}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-ink-400" />
      </Link>
    </div>
  )
}
