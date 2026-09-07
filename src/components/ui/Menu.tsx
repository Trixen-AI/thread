import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MenuProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  className?: string
}

/**
 * iOS context menu: glass panel, hairline-separated rows, springs open from
 * the trigger. Closes on outside click, Escape, or selection.
 */
export function Menu({ trigger, children, align = 'right', className }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="menu"
          className={cn(
            'glass-thick absolute z-40 mt-2 min-w-[212px] overflow-hidden rounded-[16px] p-1.5',
            'shadow-[var(--shadow-pop)] animate-[var(--animate-pop-in)]',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  hint,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
  danger?: boolean
  hint?: string
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left',
        'text-[14px] font-medium tracking-[-0.01em] transition-colors duration-150',
        danger ? 'text-danger hover:bg-danger/10' : 'text-ink-800 hover:bg-ink-700/8',
      )}
    >
      {icon && (
        <span className={cn('shrink-0', danger ? 'text-danger/70' : 'text-ink-400')}>{icon}</span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[11.5px] text-ink-400">{hint}</span>}
    </button>
  )
}

export function MenuDivider() {
  return <div className="mx-2 my-1 h-px bg-ink-700/12" />
}
