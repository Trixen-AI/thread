import { useState } from 'react'
import { Bookmark, Sparkles } from 'lucide-react'
import { selectBookmarks, selectCollectedPosts, useApp } from '@/store/appStore'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { PillTabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/Feedback'
import { PostCard } from '@/features/feed/PostCard'

const TABS = [
  { id: 'saved' as const, label: 'Saved' },
  { id: 'collected' as const, label: 'Collected' },
]

/** Where bookmarks and collected posts land — both are private to the user. */
export function SavedPage() {
  const state = useApp()
  const [tab, setTab] = useState<'saved' | 'collected'>('saved')

  const posts = tab === 'saved' ? selectBookmarks(state) : selectCollectedPosts(state)

  return (
    <>
      <MobileTopBar title="Saved" showLogo={false} />
      <AppShell>
        <div className="space-y-3">
          <div className="hidden px-3 lg:block lg:px-0">
            <h1 className="text-[28px] font-bold tracking-[-0.032em] text-ink-900">Saved</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-500">
              Only you can see what you have saved and collected.
            </p>
          </div>

          <div className="px-3 lg:px-0">
            <PillTabs items={TABS} value={tab} onChange={setTab} />
          </div>

          {posts.length === 0 ? (
            <Card className="mesh-card-flush">
              <EmptyState
                icon={
                  tab === 'saved' ? (
                    <Bookmark className="size-6" />
                  ) : (
                    <Sparkles className="size-6" />
                  )
                }
                title={tab === 'saved' ? 'Nothing saved yet' : 'Nothing collected yet'}
                description={
                  tab === 'saved'
                    ? 'Tap the bookmark on any post to keep it here.'
                    : 'Collecting a post supports its creator and keeps a copy here.'
                }
              />
            </Card>
          ) : (
            <div className="space-y-0 lg:space-y-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </>
  )
}
