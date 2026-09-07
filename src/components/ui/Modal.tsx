import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** Max width on desktop. Mobile always uses a full-width bottom sheet. */
  size?: 'sm' | 'md' | 'lg'
  /** Hide the default header row — for media viewers and custom chrome. */
  bare?: boolean
  className?: string
}

const WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-xl' }

/**
 * One dialog for the whole app: an iOS sheet that rises from the bottom on
 * phones, a centred glass panel on desktop.
 *
 * The panel body is thick material — legible for forms and long copy — while
 * the header and footer float as thin material over the scrolling content, so
 * the sheet stays readable and still reads as glass.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  bare,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink-950/35 backdrop-blur-md animate-[var(--animate-fade-in)]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'glass-thick relative flex max-h-[92vh] w-full flex-col overflow-hidden outline-none',
          'rounded-t-[28px] animate-[var(--animate-sheet-up)]',
          'sm:rounded-[28px] sm:animate-[var(--animate-pop-in)]',
          WIDTHS[size],
          className,
        )}
      >
        {/* Grab handle — the affordance that says "this sheet can be dragged" */}
        <div className="absolute inset-x-0 top-2 z-10 flex justify-center sm:hidden">
          <div className="h-[5px] w-9 rounded-full bg-ink-700/25" />
        </div>

        {!bare && (
          <header className="relative z-10 flex items-start gap-3 px-5 pt-5 pb-3 sm:pt-4">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink-900">{title}</h2>
              )}
              {description && (
                <p className="mt-0.5 text-[13.5px] leading-snug text-ink-500">{description}</p>
              )}
            </div>
            <IconButton
              label="Close"
              size="sm"
              variant="soft"
              onClick={onClose}
              className="-mr-1 -mt-0.5"
            >
              <X className="size-4" strokeWidth={2.6} />
            </IconButton>
          </header>
        )}

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {children}
        </div>

        {footer && (
          <footer className="safe-bottom hairline-t relative z-10 bg-white/55 px-5 py-3.5 backdrop-blur-xl">
            {footer}
          </footer>
        )}
        {!footer && <div className="safe-bottom" />}
      </div>
    </div>,
    document.body,
  )
}
