import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * iOS button hierarchy: filled → tinted → glass → gray → plain.
 * Presses respond with a quick spring rather than a colour flash.
 */
const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-[var(--shadow-brand)] hover:bg-brand-500 active:bg-brand-700 ' +
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.22),var(--shadow-brand)]',
  secondary:
    'glass text-ink-800 hover:bg-white/85 active:bg-white/95',
  subtle: 'bg-brand-600/12 text-brand-700 hover:bg-brand-600/18 active:bg-brand-600/24',
  soft: 'bg-ink-700/8 text-ink-700 hover:bg-ink-700/12 active:bg-ink-700/16',
  ghost: 'text-ink-600 hover:bg-ink-700/8 hover:text-ink-900 active:bg-ink-700/12',
  dark: 'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950',
  danger: 'glass text-danger hover:bg-white/85 active:bg-white/95',
} as const

const SIZES = {
  xs: 'h-7 px-2.5 text-[12px] gap-1 rounded-[9px]',
  sm: 'h-8.5 px-3.5 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-[13px]',
  lg: 'h-[52px] px-5 text-[16px] gap-2.5 rounded-[15px]',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  loading?: boolean
  block?: boolean
  /** Capsule shape — Follow, Join, Tip and other inline affordances. */
  pill?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  block,
  pill,
  icon,
  iconRight,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex select-none items-center justify-center font-semibold whitespace-nowrap',
        'tracking-[-0.01em] transition-all duration-200 [transition-timing-function:var(--ease-tap)]',
        'active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        pill && 'rounded-full',
        block && 'w-full',
        className,
      )}
    >
      {loading ? (
        <Loader2 className="size-[18px] animate-[var(--animate-spin-slow)]" aria-hidden />
      ) : (
        icon
      )}
      {children}
      {!loading && iconRight}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'soft' | 'glass'
  active?: boolean
}

export function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  active,
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        'transition-all duration-200 [transition-timing-function:var(--ease-tap)] active:scale-90',
        size === 'sm' && 'size-8',
        size === 'md' && 'size-9',
        size === 'lg' && 'size-11',
        variant === 'ghost' && 'text-ink-500 hover:bg-ink-700/8 hover:text-ink-900',
        variant === 'soft' && 'bg-ink-700/8 text-ink-600 hover:bg-ink-700/12',
        variant === 'glass' && 'glass text-ink-700 hover:bg-white/85',
        active && 'text-brand-600',
        className,
      )}
    >
      {children}
    </button>
  )
}
