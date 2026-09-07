import type { HTMLAttributes, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('mesh-card', className)} />
}

/**
 * A titled sidebar block: "Stories", "Trending", "Suggested Communities".
 * The optional action renders as a quiet link on the right.
 */
export function SectionCard({
  title,
  action,
  actionTo,
  onAction,
  children,
  className,
  bodyClassName,
}: {
  title: string
  action?: string
  actionTo?: string
  onAction?: () => void
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-[16px] font-bold tracking-[-0.02em] text-ink-900">{title}</h2>
        {action &&
          (actionTo ? (
            <Link
              to={actionTo}
              className="text-[13.5px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              {action}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="text-[13.5px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              {action}
            </button>
          ))}
        {!action && (actionTo || onAction) && (
          <ChevronRight className="size-4 text-ink-400" aria-hidden />
        )}
      </div>
      <div className={cn('px-2 pb-2', bodyClassName)}>{children}</div>
    </Card>
  )
}

/** Section heading used inside pages rather than sidebars. */
export function PageSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink-900">{title}</h2>
          {description && <p className="mt-0.5 text-[13.5px] text-ink-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
