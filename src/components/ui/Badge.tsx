import type { ReactNode } from 'react'
import { Bot, Coins, Gem, Lock, Mail, Sparkles, Star, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AccessKind } from '@/types'

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      aria-label="Verified"
      role="img"
      className={cn('size-[15px] shrink-0 text-verified', className)}
      fill="currentColor"
    >
      <path d="M11 1.5c1.3 0 2.5.6 3.2 1.6.4-.1.8-.2 1.2-.2 2 0 3.7 1.6 3.7 3.7 0 .4-.1.8-.2 1.2 1 .7 1.6 1.9 1.6 3.2s-.6 2.5-1.6 3.2c.1.4.2.8.2 1.2 0 2-1.6 3.7-3.7 3.7-.4 0-.8-.1-1.2-.2-.7 1-1.9 1.6-3.2 1.6s-2.5-.6-3.2-1.6c-.4.1-.8.2-1.2.2-2 0-3.7-1.6-3.7-3.7 0-.4.1-.8.2-1.2C2.1 13.5 1.5 12.3 1.5 11s.6-2.5 1.6-3.2c-.1-.4-.2-.8-.2-1.2 0-2 1.6-3.7 3.7-3.7.4 0 .8.1 1.2.2C8.5 2.1 9.7 1.5 11 1.5Z" />
      <path
        d="m7.4 11.2 2.4 2.4 4.8-5"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Tinted fills rather than pastel blocks, so badges sit on any surface. */
const TONES = {
  neutral: 'bg-ink-700/10 text-ink-600',
  brand: 'bg-brand-600/12 text-brand-700',
  success: 'bg-success/16 text-emerald-700',
  warn: 'bg-warn/18 text-amber-700',
  danger: 'bg-danger/14 text-danger',
  dark: 'bg-ink-900/90 text-white',
  outline: 'text-ink-600 shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.18)]',
} as const

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode
  tone?: keyof typeof TONES
  icon?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold tracking-[-0.01em]',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

const ACCESS: Record<
  AccessKind,
  { label: string; tone: keyof typeof TONES; icon: ReactNode }
> = {
  free: { label: 'Open', tone: 'success', icon: <Unlock className="size-3" /> },
  token: { label: 'Token gated', tone: 'brand', icon: <Coins className="size-3" /> },
  nft: { label: 'NFT gated', tone: 'brand', icon: <Gem className="size-3" /> },
  reputation: { label: 'Reputation', tone: 'warn', icon: <Star className="size-3" /> },
  paid: { label: 'Paid', tone: 'dark', icon: <Sparkles className="size-3" /> },
  invite: { label: 'Invite only', tone: 'neutral', icon: <Mail className="size-3" /> },
}

export function AccessBadge({ kind, className }: { kind: AccessKind; className?: string }) {
  const meta = ACCESS[kind]
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={className}>
      {meta.label}
    </Badge>
  )
}

/**
 * Marks one of the fictional accounts seeded into a fresh instance, so a
 * persona is never mistaken for a person who signed up.
 */
export function DemoAccountBadge({ className }: { className?: string }) {
  return (
    <Badge tone="neutral" className={className} icon={<Bot className="size-3" />}>
      Demo
    </Badge>
  )
}

/** Shown wherever the demo provider stands in for a real chain. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warn" icon={<Lock className="size-3" />} className={className}>
      Demo
    </Badge>
  )
}
