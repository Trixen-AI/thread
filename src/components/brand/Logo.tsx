import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * The MESH mark.
 *
 * A single ribbon folded into an M: four round-capped strokes over one zigzag,
 * where the two inner strokes sit behind the outer legs and run darker. That
 * ordering is what reads as a fold rather than as four separate bars.
 *
 * Drawn as strokes on a 100×100 grid so it stays crisp at 13px and at 300px,
 * and so the `mono` treatment is one attribute change rather than a second asset.
 */

/** Zigzag vertices: bottom-left → peak → valley → peak → bottom-right. */
const P = {
  bottomLeft: [13.8, 75.5],
  peakLeft: [33.3, 32.8],
  valley: [54.3, 70.7],
  peakRight: [75.3, 25.2],
  bottomRight: [88.6, 70.7],
} as const

const STROKE = 19

const line = (a: readonly [number, number], b: readonly [number, number]) =>
  `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`

export function LogoMark({
  className,
  tone = 'colour',
  label,
}: {
  className?: string
  /** `mono` inherits currentColor — for watermarks and tiny sizes. */
  tone?: 'colour' | 'mono'
  /**
   * Decorative by default: everywhere the mark appears it sits beside a
   * visible "MESH", and labelling both makes screen readers say it twice.
   * Pass a label only when the mark stands alone.
   */
  label?: string
}) {
  // Unique per instance so several marks on one page never share a gradient.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const g = (name: string) => `mesh-${uid}-${name}`

  const gradient = (
    name: string,
    from: readonly [number, number],
    to: readonly [number, number],
    stops: [string, string],
  ) => (
    <linearGradient
      id={g(name)}
      x1={from[0]}
      y1={from[1]}
      x2={to[0]}
      y2={to[1]}
      gradientUnits="userSpaceOnUse"
    >
      <stop stopColor={stops[0]} />
      <stop offset="1" stopColor={stops[1]} />
    </linearGradient>
  )

  const paint = (name: string) => (tone === 'mono' ? 'currentColor' : `url(#${g(name)})`)

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('shrink-0', className)}
      fill="none"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {tone === 'colour' && (
        <defs>
          {gradient('leg-l', P.bottomLeft, P.peakLeft, ['#7C6CF6', '#BAF1FC'])}
          {gradient('fold-a', P.peakLeft, P.valley, ['#C2EEFA', '#5B63F3'])}
          {gradient('fold-b', P.valley, P.peakRight, ['#1C1FCB', '#4038F0'])}
          {gradient('leg-r', P.peakRight, P.bottomRight, ['#8A6CF7', '#4A3AF1'])}
        </defs>
      )}

      <g strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
        {/* Inner folds first — the outer legs overlap them, which builds the depth. */}
        <path d={line(P.peakLeft, P.valley)} stroke={paint('fold-a')} />
        <path d={line(P.valley, P.peakRight)} stroke={paint('fold-b')} />
        <path d={line(P.bottomLeft, P.peakLeft)} stroke={paint('leg-l')} />
        <path d={line(P.peakRight, P.bottomRight)} stroke={paint('leg-r')} />
      </g>
    </svg>
  )
}

/**
 * App-icon treatment: the mark on a light squircle. Used where the logo needs
 * to hold its own against a dark or busy background.
 */
export function LogoTile({
  className,
  rounded = 'rounded-[28%]',
}: {
  className?: string
  rounded?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center bg-white',
        'shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.06)]',
        rounded,
        className,
      )}
    >
      <LogoMark className="size-[74%]" />
    </span>
  )
}

export function Logo({
  className,
  markClassName,
  wordmark = 'dark',
  showWordmark = true,
}: {
  className?: string
  markClassName?: string
  wordmark?: 'dark' | 'light'
  showWordmark?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <LogoMark className={cn('size-8', markClassName)} />
      {showWordmark && (
        <span
          className={cn(
            'text-[19px] font-extrabold tracking-[-0.04em]',
            wordmark === 'light' ? 'text-white' : 'text-ink-900',
          )}
        >
          MESH
        </span>
      )}
    </span>
  )
}
