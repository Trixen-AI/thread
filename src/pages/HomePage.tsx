import { useEffect, useState } from 'react'
import { Compass, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { selectFeed, useApp } from '@/store/appStore'
import { refreshFeed } from '@/store/actions'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Feedback'
import { UnderlineTabs } from '@/components/ui/Tabs'
import { PostCard } from '@/features/feed/PostCard'
import { PostComposer } from '@/features/feed/PostComposer'
import { StoryRail } from '@/features/stories/Stories'

type FeedTab = 'for-you' | 'following' | 'communities'

const TABS = [
  { id: 'for-you' as const, label: 'For You' },
  { id: 'following' as const, label: 'Following' },
  { id: 'communities' as const, label: 'Communities' },
]

export function HomePage() {
  const state = useApp()
  const [tab, setTab] = useState<FeedTab>('for-you')
  const posts = selectFeed(state, tab)

  // Ask the server for the scope being viewed; the store merges what comes back.
  useEffect(() => {
    if (tab !== 'communities') void refreshFeed(tab)
  }, [tab])

  return (
    <>
      <MobileTopBar />
      <AppShell>
        <div className="space-y-0 lg:space-y-3">
          {/* Stories: circular rail on mobile, tall cards in the right rail on wide screens */}
          <div className="hairline bg-white xl:hidden">
            <StoryRail />
          </div>

          {/* Composing on mobile happens through the bottom bar's create button */}
          <div className="hidden lg:block">
            <PostComposer />
          </div>

          <Card className="mesh-card-flush overflow-hidden">
            <UnderlineTabs items={TABS} value={tab} onChange={setTab} />
          </Card>

          {posts.length === 0 ? (
            <Card className="mesh-card-flush">
              {tab === 'following' ? (
                <EmptyState
                  icon={<Users className="size-6" />}
                  title="Your following feed is quiet"
                  description="Follow a few more people and their posts will show up here."
                  action={
                    <Link to="/explore?tab=people">
                      <Button size="sm" variant="subtle">
                        Find people to follow
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <EmptyState
                  icon={<Compass className="size-6" />}
                  title="No community posts yet"
                  description="Join a community to see what its members are posting."
                  action={
                    <Link to="/communities">
                      <Button size="sm" variant="subtle">
                        Browse communities
                      </Button>
                    </Link>
                  }
                />
              )}
            </Card>
          ) : (
            <div className="space-y-0 lg:space-y-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          <p className="py-6 text-center text-[12.5px] text-ink-400">
            You’re all caught up for now.
          </p>
        </div>
      </AppShell>
    </>
  )
}
