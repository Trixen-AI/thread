import type { ReactNode } from 'react'
import { sceneUrl } from '@/data/visuals'
import { cn } from '@/lib/utils'
import type { SceneKind } from '@/types'

/**
 * Generated artwork surface. Used for post media, covers, story cards and
 * marketplace items — anywhere a photograph would sit in a real deployment.
 */
export function Scene({
  kind,
  tone,
  className,
  children,
  rounded = 'rounded-2xl',
  overlay,
  fill,
}: {
  kind: SceneKind
  tone: number
  className?: string
  children?: ReactNode
  rounded?: string
  /** Darkening scrim, for text laid over the image. */
  overlay?: 'none' | 'bottom' | 'full'
  /**
   * Stretch to the nearest positioned ancestor instead of sizing itself.
   * A prop rather than an `absolute` class from the caller: Tailwind emits
   * `relative` after `absolute`, so the base class would silently win.
   */
  fill?: boolean
}) {
  return (
    <div
      className={cn(
        'overflow-hidden bg-ink-200',
        fill ? 'absolute inset-0' : 'relative',
        rounded,
        className,
      )}
      style={{ backgroundImage: sceneUrl(kind, tone), backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {overlay === 'bottom' && (
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 to-transparent" />
      )}
      {overlay === 'full' && <div className="absolute inset-0 bg-black/25" />}
      {children}
    </div>
  )
}
