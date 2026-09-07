import { avatarGradient } from '@/data/visuals'
import { cn } from '@/lib/utils'
import type { AvatarSeed } from '@/types'

const SIZES = {
  xs: 'size-6 text-[9px]',
  sm: 'size-8 text-[10px]',
  md: 'size-10 text-xs',
  lg: 'size-12 text-sm',
  xl: 'size-16 text-lg',
  '2xl': 'size-24 text-2xl',
  '3xl': 'size-[104px] text-3xl',
} as const

export type AvatarSize = keyof typeof SIZES

interface AvatarProps {
  seed: AvatarSeed
  size?: AvatarSize
  name?: string
  /** Rounded-square treatment, used for communities and org accounts. */
  square?: boolean
  className?: string
  ring?: boolean
}

/**
 * Monogram avatar on a deterministic gradient. Real profile photos would slot
 * in here without touching any caller.
 */
export function Avatar({ seed, size = 'md', name, square, className, ring }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name ? `${name} avatar` : 'avatar'}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-bold uppercase tracking-wide text-white',
        square ? 'rounded-[30%]' : 'rounded-full',
        ring && 'ring-2 ring-white',
        SIZES[size],
        className,
      )}
      style={{ backgroundImage: avatarGradient(seed) }}
    >
      <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">{seed.initials}</span>
    </span>
  )
}
