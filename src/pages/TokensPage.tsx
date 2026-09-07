import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, RefreshCw, Rocket } from 'lucide-react'
import { listRecentLaunches, type LaunchSummary } from '@/services/pons'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, RowSkeleton } from '@/components/ui/Feedback'
import { PillTabs } from '@/components/ui/Tabs'
import { TokenCard } from '@/features/pons/TokenBits'

type Filter = 'all' | 'trading' | 'graduated'

const FILTERS = [
  { id: 'all' as const, label: 'Newest' },
  { id: 'trading' as const, label: 'On the curve' },
  { id: 'graduated' as const, label: 'Graduated' },
]

/**
 * The launchpad. Every launch here is read from the factory's own events on
 * Robinhood Chain — no pons service sits in between, so what is listed is what
 * the chain says exists.
 */
export function TokensPage() {
  const [launches, setLaunches] = useState<LaunchSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const load = async () => {
    setRefreshing(true)
    setError(null)
    try {
      setLaunches(await listRecentLaunches(40))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the factory')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const shown = launches?.filter((l) =>
    filter === 'all' ? true : filter === 'trading' ? l.phase === 'trading' : l.phase === 'graduated',
  )

  return (
    <>
      <MobileTopBar title="Launchpad" showLogo={false} />
      <AppShell>
        <div className="space-y-4 px-3 py-3 lg:px-0 lg:py-0">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-[28px] font-bold tracking-[-0.032em] text-ink-900">Launchpad</h1>
              <p className="mt-0.5 text-[13.5px] text-ink-500">
                Tokens on pons v2, priced on a bonding curve and graduating into locked Uniswap v4 pools.
              </p>
            </div>
            <Link to="/launchpad/create" className="shrink-0">
              <Button icon={<Rocket className="size-[18px]" />}>Create token</Button>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <PillTabs items={FILTERS} value={filter} onChange={setFilter} className="flex-1" />
            <IconButton label="Refresh" variant="glass" onClick={() => void load()} disabled={refreshing}>
              <RefreshCw className={refreshing ? 'size-4 animate-[var(--animate-spin-slow)]' : 'size-4'} />
            </IconButton>
          </div>

          {error ? (
            <ErrorState title="Could not read the factory" description={error} action={<Button onClick={() => void load()}>Try again</Button>} />
          ) : !shown ? (
            <div className="mesh-card divide-y divide-ink-700/8">
              {Array.from({ length: 6 }, (_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<Rocket className="size-6" />}
              title={filter === 'all' ? 'No launches in the last few hours' : 'Nothing matches that filter'}
              description="The list reads the factory's most recent events. Create the next one."
              action={
                <Link to="/launchpad/create">
                  <Button>Create token</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {shown.map((launch) => (
                <TokenCard key={launch.token} launch={launch} />
              ))}
            </div>
          )}

          <p className="px-1 text-[12px] text-ink-500">
            Anyone can launch a token with any name. The address is the only identifier that cannot be copied.{' '}
            <a href="https://docs.ponsfamily.com/v2#risks" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-brand-600 hover:underline">
              Risk notes <ExternalLink className="size-3" />
            </a>
          </p>
        </div>
      </AppShell>
    </>
  )
}
