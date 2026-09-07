import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { LeftNav } from './LeftNav'
import { RightRail } from './RightRail'
import { MobileTabBar } from './MobileTabBar'
import { TopBar } from './TopBar'

/**
 * Three columns on desktop (nav · content · rail), two on tablet, one on
 * mobile with a floating tab bar. Pages opt out of the right rail when they
 * need the width — messages, wallet, marketplace.
 */
export function AppShell({
  children,
  rail = <RightRail />,
  wide,
}: {
  children: ReactNode
  rail?: ReactNode | null
  wide?: boolean
}) {
  const { pathname } = useLocation()

  // New route, new scroll position — matching native app behaviour.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh">
      <TopBar />

      <div
        className={cn(
          'mx-auto flex w-full gap-5 px-0 lg:px-5',
          wide ? 'max-w-[1440px]' : 'max-w-[1360px]',
        )}
      >
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[212px] shrink-0 overflow-y-auto scroll-slim py-4 lg:block">
          <LeftNav />
        </aside>

        {/* Bottom padding clears the floating tab bar on phones. */}
        <main className={cn('min-w-0 flex-1 pb-[104px] lg:py-4 lg:pb-10', wide && 'lg:pb-4')}>
          {children}
        </main>

        {rail && (
          <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-[312px] shrink-0 overflow-y-auto scroll-slim py-4 xl:block">
            {rail}
          </aside>
        )}
      </div>

      <MobileTabBar />
    </div>
  )
}

/** Sticky in-page header for secondary screens (back button + title). */
export function PageHeader({
  title,
  subtitle,
  action,
  onBack,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  onBack?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'glass-bar hairline sticky top-0 z-20 flex items-center gap-3 px-4 py-3 lg:top-16',
        className,
      )}
    >
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Go back"
          className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-full text-brand-600 transition-colors hover:bg-ink-700/8"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-[22px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-ink-900">
          {title}
        </h1>
        {subtitle && <p className="truncate text-[12.5px] text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
