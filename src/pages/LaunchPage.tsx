import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readLaunchTerms, type LaunchTerms } from '@/services/pons'
import type { LaunchOutcome } from '@/store/actions'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/Feedback'
import { LaunchForm, LaunchFormSkeleton, LaunchSuccess } from '@/features/pons/LaunchForm'

/**
 * Create a token on pons v2.
 *
 * The form does not render until the factory has answered: what it charges,
 * which configs are open, and which quote assets it will accept. A form built
 * from assumptions would be one that fails at the wallet prompt.
 */
export function LaunchPage() {
  const navigate = useNavigate()
  const [terms, setTerms] = useState<LaunchTerms | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<LaunchOutcome | null>(null)

  const load = () => {
    setError(null)
    setTerms(null)
    readLaunchTerms()
      .then(setTerms)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not read the factory'))
  }

  useEffect(load, [])

  return (
    <>
      <MobileTopBar title="Create token" showLogo={false} />
      <AppShell rail={null}>
        <div className="mx-auto max-w-[720px]">
          <PageHeader
            title="Create a token"
            subtitle="pons v2 · Robinhood Chain"
            onBack={() => navigate(-1)}
            className="lg:rounded-[16px]"
          />
          <div className="px-3 py-4 lg:px-0">
            {outcome?.result ? (
              <LaunchSuccess outcome={outcome} />
            ) : error ? (
              <ErrorState
                title="Could not reach the factory"
                description={error}
                action={<Button onClick={load}>Try again</Button>}
              />
            ) : terms ? (
              <LaunchForm terms={terms} onLaunched={setOutcome} />
            ) : (
              <LaunchFormSkeleton />
            )}
          </div>
        </div>
      </AppShell>
    </>
  )
}
