import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * iOS fields are recessed rather than outlined: a soft fill in the resting
 * state, lifting to white with a tint ring on focus.
 */
const FIELD_BASE =
  'w-full rounded-[12px] bg-ink-700/[0.06] text-[15px] tracking-[-0.01em] text-ink-900 ' +
  'shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.06)] placeholder:text-ink-400 ' +
  'transition-all duration-200 hover:bg-ink-700/[0.09] ' +
  'focus:bg-white focus:shadow-[inset_0_0_0_1.5px_var(--color-brand-500)] focus:outline-none'

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode; trailing?: ReactNode }
>(function Input({ className, leading, trailing, ...props }, ref) {
  return (
    <div className="relative flex items-center">
      {leading && (
        <span className="pointer-events-none absolute left-3.5 text-ink-400">{leading}</span>
      )}
      <input
        ref={ref}
        {...props}
        className={cn(
          FIELD_BASE,
          'h-11 px-3.5',
          !!leading && 'pl-10',
          !!trailing && 'pr-12',
          className,
        )}
      />
      {trailing && <span className="absolute right-3.5 text-ink-400">{trailing}</span>}
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} {...props} className={cn(FIELD_BASE, 'resize-none px-3.5 py-3', className)} />
  },
)

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-semibold tracking-[-0.01em] text-ink-600">
        {label}
      </span>
      {children}
      {error ? (
        <span className="block text-[12.5px] font-medium text-danger">{error}</span>
      ) : (
        hint && <span className="block text-[12.5px] leading-snug text-ink-500">{hint}</span>
      )}
    </label>
  )
}

/** iOS switch at its native proportions — 51×31 with a 27px knob. */
export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-[12px] px-1 py-2.5 text-left transition-colors hover:bg-ink-700/[0.04]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium tracking-[-0.01em] text-ink-900">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-500">
            {description}
          </span>
        )}
      </span>
      <span
        className={cn(
          'relative mt-0.5 h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300',
          checked ? 'bg-success' : 'bg-ink-700/16',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] size-[27px] rounded-full bg-white',
            'shadow-[0_3px_8px_rgb(16_16_24/0.15),0_1px_1px_rgb(16_16_24/0.16)]',
            'transition-all duration-300 [transition-timing-function:var(--ease-sheet)]',
            checked ? 'left-[22px]' : 'left-[2px]',
          )}
        />
      </span>
    </button>
  )
}
