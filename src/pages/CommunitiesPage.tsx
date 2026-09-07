import { useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'
import { selectMyCommunities, useApp } from '@/store/appStore'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card, PageSection } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { PillTabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/Feedback'
import { CommunityCard, CommunityRow } from '@/components/social/CommunityBits'

export function CommunitiesPage() {
  const state = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('trending')

  const categories = useMemo(() => {
    const unique = Array.from(new Set(state.communities.map((c) => c.category)))
    return [
      { id: 'trending', label: 'Trending' },
      ...unique.map((c) => ({ id: c.toLowerCase(), label: c })),
    ]
  }, [state.communities])

  const mine = selectMyCommunities(state)

  const filtered = state.communities
    .filter((c) => {
      const matchesQuery =
        !query.trim() ||
        `${c.name} ${c.description} ${c.category}`.toLowerCase().includes(query.toLowerCase())
      const matchesCategory =
        category === 'trending' || c.category.toLowerCase() === category
      return matchesQuery && matchesCategory
    })
    .sort((a, b) => b.members - a.members)

  return (
    <>
      <MobileTopBar title="Communities" showLogo={false} />
      <AppShell>
        <div className="space-y-4 px-3 py-3 lg:px-0 lg:py-0">
          <div className="hidden lg:block">
            <h1 className="text-[28px] font-bold tracking-[-0.032em] text-ink-900">Communities</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-500">
              Groups built around what people make, hold and care about.
            </p>
          </div>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search communities..."
            leading={<Search className="size-4" />}
          />

          <PillTabs items={categories} value={category} onChange={setCategory} />

          {mine.length > 0 && category === 'trending' && !query && (
            <PageSection title="Your communities" description={`${mine.length} joined`}>
              <Card className="p-2">
                {mine.map((community) => (
                  <CommunityRow key={community.id} community={community} showDescription />
                ))}
              </Card>
            </PageSection>
          )}

          <PageSection
            title={query ? `Results for “${query}”` : 'Discover'}
            description={`${filtered.length} ${filtered.length === 1 ? 'community' : 'communities'}`}
          >
            {filtered.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Users className="size-6" />}
                  title="No communities found"
                  description="Try a different search or category."
                />
              </Card>
            ) : (
              <>
                {/* Cards on wide screens, compact rows on mobile */}
                <div className="hidden gap-3 sm:grid sm:grid-cols-2">
                  {filtered.map((community) => (
                    <CommunityCard key={community.id} community={community} />
                  ))}
                </div>
                <Card className="p-2 sm:hidden">
                  {filtered.map((community) => (
                    <CommunityRow key={community.id} community={community} showDescription />
                  ))}
                </Card>
              </>
            )}
          </PageSection>
        </div>
      </AppShell>
    </>
  )
}
