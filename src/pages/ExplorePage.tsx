import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Hash, TrendingUp } from 'lucide-react'
import { compact, tokenAmount } from '@/lib/utils'
import { setUi, useApp } from '@/store/appStore'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card, PageSection } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PillTabs } from '@/components/ui/Tabs'
import { Scene } from '@/components/social/Scene'
import { UserRow } from '@/components/social/UserBits'
import { CommunityCard } from '@/components/social/CommunityBits'
import { PostCard } from '@/features/feed/PostCard'
import { SearchBox } from '@/features/search/SearchBox'

const TABS = [
  { id: 'trending' as const, label: 'Trending' },
  { id: 'people' as const, label: 'People' },
  { id: 'communities' as const, label: 'Communities' },
  { id: 'collectibles' as const, label: 'Collectibles' },
]

type Tab = (typeof TABS)[number]['id']

export function ExplorePage() {
  const state = useApp()
  const [params, setParams] = useSearchParams()
  const initial = (params.get('tab') as Tab) || 'trending'
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initial) ? initial : 'trending')

  const changeTab = (next: Tab) => {
    setTab(next)
    setParams(next === 'trending' ? {} : { tab: next }, { replace: true })
  }

  const popular = [...state.posts].sort((a, b) => b.likes - a.likes).slice(0, 6)
  // Everyone with an account here, real people before seeded personas.
  const people = [...state.users]
    .filter((u) => u.id !== state.me?.id)
    .sort((a, b) => Number(a.isDemo) - Number(b.isDemo) || b.followers - a.followers)
  const suggested = state.users.filter(
    (u) => u.id !== state.me?.id && !state.following.includes(u.id),
  )

  return (
    <>
      <MobileTopBar title="Explore" showLogo={false} />
      <AppShell>
        <div className="space-y-4 px-3 py-3 lg:px-0 lg:py-0">
          <div className="lg:hidden">
            <SearchBox placeholder="Search MESH..." />
          </div>

          <div className="hidden lg:block">
            <h1 className="text-[28px] font-bold tracking-[-0.032em] text-ink-900">Explore</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-500">
              What the network is talking about right now.
            </p>
          </div>

          <PillTabs items={TABS} value={tab} onChange={changeTab} />

          {tab === 'trending' && (
            <div className="space-y-4">
              <PageSection title="Trending topics">
                <div className="grid gap-2 sm:grid-cols-2">
                  {state.trends.map((trend, i) => (
                    <Link
                      key={trend.id}
                      to={`/search?q=${encodeURIComponent(trend.topic)}`}
                      className="mesh-card flex items-center gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-raise)]"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
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
                        <span className="block truncate text-[12px] text-ink-500">
                          {trend.category} · {compact(trend.posts)} posts
                        </span>
                      </span>
                      <span className="text-[12px] font-bold text-ink-300">#{i + 1}</span>
                    </Link>
                  ))}
                </div>
              </PageSection>

              <PageSection title="Popular posts" description="Most engaged with this week">
                <div className="space-y-3">
                  {popular.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </PageSection>
            </div>
          )}

          {tab === 'people' && (
            <div className="space-y-4">
              <PageSection title="People on MESH" description={`${people.length} accounts you can follow and message`}>
                <Card className="p-2">
                  {people.map((user) => (
                    <UserRow key={user.id} user={user} subtitle={user.bio.split('\n')[0]} />
                  ))}
                </Card>
              </PageSection>

              <PageSection title="Suggested for you">
                <Card className="p-2">
                  {suggested.map((user) => (
                    <UserRow key={user.id} user={user} subtitle={`@${user.handle}`} />
                  ))}
                </Card>
              </PageSection>
            </div>
          )}

          {tab === 'communities' && (
            <PageSection title="Communities" description="Sorted by size">
              <div className="grid gap-3 sm:grid-cols-2">
                {[...state.communities]
                  .sort((a, b) => b.members - a.members)
                  .map((community) => (
                    <CommunityCard key={community.id} community={community} />
                  ))}
              </div>
            </PageSection>
          )}

          {tab === 'collectibles' && (
            <div className="space-y-4">
              <PageSection
                title="Collectible posts"
                description="Support a creator by collecting their work"
              >
                <div className="space-y-3">
                  {state.posts
                    .filter((p) => p.collectible)
                    .slice(0, 4)
                    .map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                </div>
              </PageSection>

              <PageSection
                title="From the marketplace"
                action={
                  <Link to="/marketplace">
                    <Button size="sm" variant="ghost">
                      See all
                    </Button>
                  </Link>
                }
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {state.marketplace.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setUi({ buyItemId: item.id })}
                      className="mesh-card overflow-hidden text-left transition-shadow hover:shadow-[var(--shadow-raise)]"
                    >
                      <Scene
                        kind={item.scene}
                        tone={item.tone}
                        rounded="rounded-none"
                        className="aspect-square"
                      />
                      <div className="p-2.5">
                        <p className="truncate text-[13px] font-bold text-ink-900">{item.title}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
                          {item.price === 0
                            ? 'Free'
                            : `${tokenAmount(item.price, item.asset)} ${item.asset}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </PageSection>
            </div>
          )}
        </div>
      </AppShell>
    </>
  )
}
