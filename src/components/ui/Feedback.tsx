import type { ReactNode } from 'react'
import { AlertTriangle, Check, Coins, Heart, Loader2, Users, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/store/appStore'
import { dismissToast } from '@/store/actions'
import type { Toast } from '@/types'

/* -------------------------------- Skeletons ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('mesh-skeleton rounded-lg', className)} aria-hidden />
}

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="h-7 w-16 rounded-full" />
    </div>
  )
}

/* ------------------------------- Empty state ------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-3 flex size-14 items-center justify-center rounded-[16px] bg-ink-700/8 text-ink-400">
        {icon}
      </div>
      <h3 className="text-[15px] font-bold text-ink-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-ink-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <EmptyState
      icon={<AlertTriangle className="size-6" />}
      title={title}
      description={description}
      action={action}
    />
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('size-5 animate-[var(--animate-spin-slow)] text-ink-400', className)}
      aria-label="Loading"
    />
  )
}

/* --------------------------------- Toasts -------------------------------- */

const TOAST_ICONS = {
  check: Check,
  wallet: Wallet,
  heart: Heart,
  users: Users,
  coins: Coins,
  alert: AlertTriangle,
}

/** Tone lives in the icon chip, not the whole panel — the panel is material. */
const TOAST_TONES: Record<Toast['tone'], string> = {
  default: 'bg-ink-800 text-white',
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
  brand: 'bg-brand-600 text-white',
}

function ToastCard({ toast }: { toast: Toast }) {
  const Icon = toast.icon ? TOAST_ICONS[toast.icon] : Check
  return (
    <button
      onClick={() => dismissToast(toast.id)}
      className={cn(
        'glass-thick pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[18px]',
        'px-3.5 py-3 text-left shadow-[var(--shadow-pop)] animate-[var(--animate-toast-in)]',
        'transition-transform duration-200 active:scale-[0.98]',
      )}
    >
      <span
        className={cn(
          'mt-px flex size-[22px] shrink-0 items-center justify-center rounded-full',
          TOAST_TONES[toast.tone],
        )}
      >
        <Icon className="size-[13px]" strokeWidth={2.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold tracking-[-0.01em] text-ink-900">
          {toast.title}
        </span>
        {toast.description && (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-600">
            {toast.description}
          </span>
        )}
      </span>
    </button>
  )
}

export function Toaster() {
  const { toasts } = useApp()
  if (!toasts.length) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[108px] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end lg:px-0"
    >
      {toasts.slice(-3).map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  )
}
