import { Link } from 'react-router-dom'
import { compact } from '@/lib/utils'
import { selectSuggestedCommunities, useApp } from '@/store/appStore'
import { SectionCard } from '@/components/ui/Card'
import { CommunityRow } from '@/components/social/CommunityBits'
import { StoryCards } from '@/features/stories/Stories'

export function TrendingCard({ limit = 5 }: { limit?: number }) {
  const { trends } = useApp()
  return (
    <SectionCard title="Trending" action="" actionTo="/explore?tab=trending">
      <ol className="space-y-0.5">
        {trends.slice(0, limit).map((trend, i) => (
          <li key={trend.id}>
            <Link
              to={`/search?q=${encodeURIComponent(trend.topic)}`}
              className="flex items-baseline gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-ink-700/[0.05]"
            >
              <span className="w-3 shrink-0 text-[13px] font-bold text-ink-400">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-ink-900">
                  {trend.topic}
                </span>
                <span className="block text-[12.5px] text-ink-500">
                  {compact(trend.posts)} posts
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}

export function SuggestedCommunitiesCard({ limit = 4 }: { limit?: number }) {
  const state = useApp()
  const communities = selectSuggestedCommunities(state, limit)
  if (!communities.length) return null

  return (
    <SectionCard title="Suggested Communities" action="See all" actionTo="/communities">
      {communities.map((community) => (
        <CommunityRow key={community.id} community={community} />
      ))}
    </SectionCard>
  )
}

/** Desktop-only third column: stories, trends, communities. */
export function RightRail() {
  return (
    <div className="space-y-3">
      <SectionCard title="Stories" action="See all" actionTo="/explore" bodyClassName="px-2 pb-3">
        <StoryCards />
      </SectionCard>

      <TrendingCard />
      <SuggestedCommunitiesCard />

      <footer className="px-3 pb-8 pt-1 text-[11.5px] leading-relaxed text-ink-400">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Link to="/settings" className="hover:text-ink-600">
            Settings
          </Link>
          <a className="hover:text-ink-600" href="#privacy">
            Privacy
          </a>
          <a className="hover:text-ink-600" href="#terms">
            Terms
          </a>
          <a className="hover:text-ink-600" href="#help">
            Help
          </a>
        </div>
        <p className="mt-2">© 2026 MESH · Your Identity. Your Network. Your Value.</p>
      </footer>
    </div>
  )
}
