import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ShoppingBag } from 'lucide-react'
import { cn, compact, tokenAmount } from '@/lib/utils'
import type { MarketplaceItem } from '@/types'
import { selectUser, setUi, useApp } from '@/store/appStore'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card, PageSection } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { PillTabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Field'
import { Scene } from '@/components/social/Scene'
import { TokenIcon } from '@/features/wallet/TokenIcon'

const CATEGORIES = [
  { id: 'all' as const, label: 'All' },
  { id: 'nft' as const, label: 'NFTs' },
  { id: 'membership' as const, label: 'Memberships' },
  { id: 'event' as const, label: 'Events' },
  { id: 'digital' as const, label: 'Digital Products' },
]

export function MarketplacePage() {
  const state = useApp()
  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState('')

  const items = state.marketplace.filter((item) => {
    const matchesCategory = category === 'all' || item.category === category
    const matchesQuery =
      !query.trim() ||
      `${item.title} ${item.subtitle}`.toLowerCase().includes(query.toLowerCase())
    return matchesCategory && matchesQuery
  })

  const featured = state.marketplace[0]

  return (
    <>
      <MobileTopBar title="Marketplace" showLogo={false} />
      <AppShell rail={null}>
        <div className="space-y-4 px-3 py-3 lg:px-0 lg:py-0">
          <div className="hidden lg:block">
            <h1 className="text-[28px] font-bold tracking-[-0.032em] text-ink-900">Marketplace</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-500">
              Passes, memberships, events and digital goods from people you follow.
            </p>
          </div>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items..."
            leading={<Search className="size-4" />}
          />

          <PillTabs items={CATEGORIES} value={category} onChange={setCategory} />

          {category === 'all' && !query && featured && (
            <Card className="overflow-hidden">
              <div className="sm:flex">
                <Scene
                  kind={featured.scene}
                  tone={featured.tone}
                  rounded="rounded-none"
                  className="h-40 sm:h-auto sm:w-2/5"
                />
                <div className="flex flex-1 flex-col justify-center p-4">
                  <Badge tone="brand" className="w-fit">
                    Featured
                  </Badge>
                  <h2 className="mt-2 text-[21px] font-bold tracking-[-0.03em] text-ink-900">
                    {featured.title}
                  </h2>
                  <p className="mt-1 text-[13.5px] text-ink-500">{featured.subtitle}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[16px] font-bold tracking-[-0.02em] text-ink-900">
                      <TokenIcon symbol={featured.asset} size="sm" />
                      {tokenAmount(featured.price, featured.asset)} {featured.asset}
                    </span>
                    <span className="text-[12.5px] text-ink-500">
                      {compact(featured.metricValue)} {featured.metricLabel}
                    </span>
                  </div>
                  <Button
                    className="mt-3 w-fit"
                    size="sm"
                    disabled={featured.ownedByMe}
                    onClick={() => setUi({ buyItemId: featured.id })}
                  >
                    {featured.ownedByMe ? 'You own this' : 'View item'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <PageSection
            title={query ? `Results for “${query}”` : CATEGORIES.find((c) => c.id === category)!.label}
            description={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}
          >
            {items.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<ShoppingBag className="size-6" />}
                  title="Nothing here yet"
                  description="Try another category or search term."
                />
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {items.map((item) => (
                  <MarketCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </PageSection>
        </div>
      </AppShell>
    </>
  )
}

function MarketCard({ item }: { item: MarketplaceItem }) {
  const state = useApp()
  const creator = selectUser(state, item.creatorId)

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-raise)]">
      <div className="relative">
        <Scene
          kind={item.scene}
          tone={item.tone}
          rounded="rounded-none"
          className="aspect-square transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {item.ownedByMe && (
          <Badge tone="success" className="glass absolute left-2 top-2 !text-emerald-700">
            Owned
          </Badge>
        )}
        {item.soldOut && !item.ownedByMe && (
          <Badge tone="dark" className="absolute left-2 top-2">
            Sold out
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="truncate text-[14px] font-bold text-ink-900">{item.title}</h3>
        <p className="mt-0.5 line-clamp-2 min-h-[32px] text-[12px] leading-snug text-ink-500">
          {item.subtitle}
        </p>

        <Link
          to={`/u/${creator.handle}`}
          className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-500 hover:text-ink-700"
        >
          <Avatar seed={creator.avatar} size="xs" name={creator.name} />
          <span className="truncate">{creator.name}</span>
        </Link>

        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-[-0.02em] text-ink-900">
              {item.price === 0
                ? 'Free'
                : `${tokenAmount(item.price, item.asset)} ${item.asset}`}
            </p>
            <p className="truncate text-[11.5px] text-ink-500">
              {compact(item.metricValue)} {item.metricLabel}
            </p>
          </div>
          <Button
            size="xs"
            pill
            variant={item.ownedByMe ? 'secondary' : 'subtle'}
            disabled={item.soldOut && !item.ownedByMe}
            onClick={() => setUi({ buyItemId: item.id })}
            className={cn(item.ownedByMe && 'pointer-events-none')}
          >
            {item.ownedByMe ? 'Owned' : item.soldOut ? 'Sold out' : 'Buy'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
