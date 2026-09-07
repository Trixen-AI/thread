import { cn } from '@/lib/utils'

export interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * Underline tabs — the feed's primary switcher. The indicator is one element
 * that slides between positions, so switching reads as movement rather than a
 * bar blinking out in one place and in at another.
 */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: TabsProps<T>) {
  const index = Math.max(
    0,
    items.findIndex((i) => i.id === value),
  )

  return (
    <div role="tablist" className={cn('relative flex items-stretch', className)}>
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative flex-1 px-2 pt-3.5 pb-3.5 text-[15px] font-semibold tracking-[-0.01em]',
              'transition-colors duration-200',
              active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-700',
            )}
          >
            {item.label}
          </button>
        )
      })}

      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 h-[3px] transition-transform duration-300 [transition-timing-function:var(--ease-sheet)]"
        style={{
          width: `${100 / items.length}%`,
          transform: `translateX(${index * 100}%)`,
        }}
      >
        <span className="mx-auto block h-full w-12 rounded-full bg-brand-600" />
      </span>
    </div>
  )
}

/**
 * Capsule filters — profile sections, marketplace categories, explore scopes.
 * Scrolls horizontally on narrow screens rather than wrapping.
 */
export function PillTabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn('no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5', className)}
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-[7px] text-[13.5px] font-semibold tracking-[-0.01em]',
              'transition-all duration-200 [transition-timing-function:var(--ease-tap)] active:scale-[0.96]',
              active
                ? 'bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),var(--shadow-brand)]'
                : 'glass text-ink-600 hover:text-ink-900',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn('ml-1.5 text-[11.5px]', active ? 'text-white/70' : 'text-ink-400')}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * iOS segmented control. A single knob slides between segments; the track is a
 * recessed fill, and labels above it never move.
 */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: TabsProps<T>) {
  const index = Math.max(
    0,
    items.findIndex((i) => i.id === value),
  )

  return (
    <div
      role="tablist"
      className={cn(
        'relative flex rounded-[10px] bg-ink-700/8 p-[2px]',
        'shadow-[inset_0_0.5px_1px_rgb(16_16_24/0.06)]',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-[2px] left-[2px] rounded-[8px] bg-white',
          'shadow-[0_1px_3px_rgb(16_16_24/0.14),0_0_0_0.5px_rgb(16_16_24/0.04)]',
          'transition-transform duration-300 [transition-timing-function:var(--ease-sheet)]',
        )}
        style={{
          width: `calc((100% - 4px) / ${items.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative z-10 flex-1 rounded-[8px] px-3 py-[7px] text-[13.5px] font-semibold',
              'tracking-[-0.01em] transition-colors duration-200',
              active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-700',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
