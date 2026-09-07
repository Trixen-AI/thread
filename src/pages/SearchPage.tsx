import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Hash, SearchX, TrendingUp } from 'lucide-react'
import { compact, tokenAmount } from '@/lib/utils'
import type { SearchScope } from '@/types'
import { useApp } from '@/store/appStore'
import { searchPeople } from '@/store/actions'
import { search } from '@/services/social/search'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card, PageSection } from '@/components/ui/Card'
import { PillTabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/Feedback'
import { Scene } from '@/components/social/Scene'
import { UserRow } from '@/components/social/UserBits'
import { CommunityRow } from '@/components/social/CommunityBits'
import { PostCard } from '@/features/feed/PostCard'
import { SearchBox } from '@/features/search/SearchBox'

const SCOPES: Array<{ id: SearchScope; label: string }> = [
  { id: 'top', label: 'Top' },
  { id: 'people', label: 'People' },
  { id: 'posts', label: 'Posts' },
  { id: 'communities', label: 'Communities' },
  { id: 'collectibles', label: 'Collectibles' },
]

export function SearchPage() {
  const state = useApp()
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  const [scope, setScope] = useState<SearchScope>('top')

  const results = useMemo(() => search(state, query, 20), [state, query])

  useEffect(() => {
    if (query.trim()) void searchPeople(query.trim())
  }, [query])
  const showAll = scope === 'top'

  return (
    <>
      <MobileTopBar title="Search" showLogo={false} />
      <AppShell>
        <div className="space-y-4 px-3 py-3 lg:px-0 lg:py-0">
          <SearchBox placeholder="Search people, communities, or posts..." autoFocus={!query} />

          {!query ? (
            <PageSection title="Trending searches">
              <Card className="p-2">
                {state.trends.map((trend) => (
                  <Link
                    key={trend.id}
                    to={`/search?q=${encodeURIComponent(trend.topic)}`}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-ink-700/[0.05]"
                  >
                    <span className="flex size-9 items-center justify-center rounded-full bg-ink-700/8 text-ink-500">
                      {trend.topic.startsWith('#') ? (
                        <Hash className="size-4" />
                      ) : (
                        <TrendingUp className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-ink-900">
                        {trend.topic}
                      </span>
                      <span className="block text-[12px] text-ink-500">
                        {compact(trend.posts)} posts
                      </span>
                    </span>
                  </Link>
                ))}
              </Card>
            </PageSection>
          ) : (
            <>
              <p className="text-[13.5px] text-ink-500">
                {results.total} {results.total === 1 ? 'result' : 'results'} for{' '}
                <span className="font-semibold text-ink-800">“{query}”</span>
              </p>

              <PillTabs items={SCOPES} value={scope} onChange={setScope} />

              {results.total === 0 && (
                <Card>
                  <EmptyState
                    icon={<SearchX className="size-6" />}
                    title="No results"
                    description="Try a different spelling, or search for a topic instead."
                  />
                </Card>
              )}

              {(showAll || scope === 'people') && results.people.length > 0 && (
                <PageSection title="People">
                  <Card className="p-2">
                    {results.people.map((user) => (
                      <UserRow key={user.id} user={user} subtitle={user.bio.split('\n')[0]} />
                    ))}
                  </Card>
                </PageSection>
              )}

              {(showAll || scope === 'communities') && results.communities.length > 0 && (
                <PageSection title="Communities">
                  <Card className="p-2">
                    {results.communities.map((community) => (
                      <CommunityRow key={community.id} community={community} showDescription />
                    ))}
                  </Card>
                </PageSection>
              )}

              {(showAll || scope === 'posts') && results.posts.length > 0 && (
                <PageSection title="Posts">
                  <div className="space-y-3">
                    {results.posts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                </PageSection>
              )}

              {(showAll || scope === 'collectibles') && results.collectibles.length > 0 && (
                <PageSection title="Collectibles">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {results.collectibles.map((item) => (
                      <Card key={item.id} className="overflow-hidden">
                        <Scene
                          kind={item.scene}
                          tone={item.tone}
                          rounded="rounded-none"
                          className="aspect-square"
                        />
                        <div className="p-2.5">
                          <p className="truncate text-[13px] font-bold text-ink-900">
                            {'title' in item ? item.title : item.name}
                          </p>
                          <p className="truncate text-[11.5px] text-ink-500">
                            {'price' in item
                              ? `${tokenAmount(item.price, item.asset)} ${item.asset}`
                              : item.collection}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </PageSection>
              )}
            </>
          )}
        </div>
      </AppShell>
    </>
  )
}
