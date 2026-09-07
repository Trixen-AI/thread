import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { cn, shortAddress } from '@/lib/utils'
import type { AvatarSeed } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import {
  explorerAddress,
  phaseDetail,
  phaseLabel,
  type LaunchPhase,
  type LaunchSummary,
} from '@/services/pons'
import { ago, fmtPct, fmtUnits, imageUrl } from './format'

/**
 * Small pieces shared by the launchpad screens: a token's mark, its phase, the
 * curve's progress, and the card that lists it.
 */

/** A deterministic monogram for a token with no logo, or one that failed to load. */
export function tokenSeed(symbol: string, address: string): AvatarSeed {
  let hash = 0
  for (const ch of address.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return { initials: symbol.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?', tone: hash % 12 }
}

export function TokenLogo({
  logo,
  symbol,
  address,
  size = 'md',
  className,
}: {
  logo?: string
  symbol: string
  address: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const src = logo ? imageUrl(logo) : null
  // Matches Avatar's own scale, so a token with a logo and one without sit at
  // the same size in the same row.
  const px = { sm: 'size-8', md: 'size-10', lg: 'size-12', xl: 'size-16' }[size]

  if (!src || broken) {
    return <Avatar seed={tokenSeed(symbol, address)} size={size} name={symbol} className={className} />
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setBroken(true)}
      className={cn('shrink-0 rounded-full bg-ink-100 object-cover', px, className)}
    />
  )
}

const PHASE_TONE: Record<LaunchPhase, 'success' | 'warn' | 'brand' | 'danger'> = {
  trading: 'success',
  swept: 'warn',
  graduated: 'brand',
  rescued: 'danger',
}

export function PhaseBadge({ phase, className }: { phase: LaunchPhase; className?: string }) {
  return (
    <Badge tone={PHASE_TONE[phase]} className={className}>
      <span title={phaseDetail[phase]}>{phaseLabel[phase]}</span>
    </Badge>
  )
}

/**
 * How far along the curve is. Raised against the threshold, both in the quote
 * asset — the same figure the contract graduates on.
 */
export function CurveProgress({
  progress,
  raised,
  threshold,
  quoteSymbol,
  quoteDecimals,
  compact,
}: {
  progress: number
  raised: bigint
  threshold: bigint
  quoteSymbol: string
  quoteDecimals: number
  compact?: boolean
}) {
  const pct = Math.max(0, Math.min(1, progress))
  return (
    <div className={cn(!compact && 'space-y-1.5')}>
      {!compact && (
        <div className="flex items-baseline justify-between text-[12.5px]">
          <span className="font-semibold text-ink-700">
            {fmtUnits(raised, quoteDecimals)} / {fmtUnits(threshold, quoteDecimals)} {quoteSymbol}
          </span>
          <span className="font-bold tabular-nums text-brand-700">{fmtPct(pct)}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn('overflow-hidden rounded-full bg-ink-700/10', compact ? 'h-1.5' : 'h-2')}
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-500 [transition-timing-function:var(--ease-sheet)]"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

/** An address with a copy control and an explorer link. */
export function AddressChip({ address, label }: { address: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-700/[0.06] py-1 pl-2.5 pr-1 font-mono text-[12px] text-ink-700">
      {label && <span className="font-sans font-semibold text-ink-500">{label}</span>}
      {shortAddress(address, 6, 4)}
      <button
        onClick={copy}
        aria-label="Copy address"
        className="flex size-6 items-center justify-center rounded-full text-ink-400 hover:bg-ink-700/8 hover:text-ink-800"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
      <a
        href={explorerAddress(address)}
        target="_blank"
        rel="noreferrer"
        aria-label="View on Blockscout"
        className="flex size-6 items-center justify-center rounded-full text-ink-400 hover:bg-ink-700/8 hover:text-ink-800"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </span>
  )
}

export function TokenCard({ launch }: { launch: LaunchSummary }) {
  return (
    <Link
      to={`/t/${launch.token}`}
      className="mesh-card flex items-center gap-3 p-3.5 transition-shadow hover:shadow-[var(--shadow-raise)]"
    >
      <TokenLogo symbol={launch.symbol} address={launch.token} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink-900">{launch.name}</p>
          <span className="shrink-0 text-[12.5px] font-semibold text-ink-500">${launch.symbol}</span>
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-ink-500">
          Priced in {launch.quote.symbol} · {ago(launch.launchedAt)} · by {shortAddress(launch.deployer)}
        </p>
        <div className="mt-2">
          <CurveProgress
            compact
            progress={launch.progress}
            raised={launch.raised}
            threshold={launch.graduationThreshold}
            quoteSymbol={launch.quote.symbol}
            quoteDecimals={launch.quote.decimals}
          />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <PhaseBadge phase={launch.phase} />
        <span className="text-[12.5px] font-bold tabular-nums text-brand-700">{fmtPct(launch.progress)}</span>
      </div>
    </Link>
  )
}
