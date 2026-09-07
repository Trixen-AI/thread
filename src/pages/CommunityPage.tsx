import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, Gem, Lock, Share2, Users } from 'lucide-react'
import { compact, longDate } from '@/lib/utils'
import {
  isMember,
  selectCommunityBySlug,
  selectCommunityPosts,
  selectCredential,
  selectMembership,
  setUi,
  useApp,
} from '@/store/appStore'
import { checkAccess, toast } from '@/store/actions'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { AccessBadge, Badge, VerifiedBadge } from '@/components/ui/Badge'
import { PillTabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/Feedback'
import { Scene } from '@/components/social/Scene'
import { JoinButton } from '@/components/social/CommunityBits'
import { UserRow } from '@/components/social/UserBits'
import { PostCard } from '@/features/feed/PostCard'
import { PostComposer } from '@/features/feed/PostComposer'

type Tab = 'posts' | 'members' | 'about' | 'collectibles'

const TABS = [
  { id: 'posts' as const, label: 'Posts' },
  { id: 'members' as const, label: 'Members' },
  { id: 'about' as const, label: 'About' },
  { id: 'collectibles' as const, label: 'Collectibles' },
]

export function CommunityPage() {
  const { slug = '' } = useParams()
  const state = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('posts')

  const community = selectCommunityBySlug(state, slug)
  if (!community) return <Navigate to="/communities" replace />

  const joined = isMember(state, community.id)
  const membership = selectMembership(state, community.id)
  const credential = selectCredential(state, community.id)
  const posts = selectCommunityPosts(state, community.id)
  const access = checkAccess(community)
  const members = state.users.slice(1, 9)

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${community.slug}`)
      toast({ title: 'Community link copied', tone: 'default', icon: 'check' })
    } catch {
      toast({ title: 'Could not copy link', tone: 'error', icon: 'alert' })
    }
  }

  return (
    <>
      <MobileTopBar title={community.name} showLogo={false} />
      <AppShell>
        <div className="space-y-3">
          <Card className="mesh-card-flush overflow-hidden">
            <Scene
              kind={community.cover.scene}
              tone={community.cover.tone}
              rounded="rounded-none"
              className="h-32 sm:h-40"
            />

            <div className="px-4 pb-4">
              <div className="flex items-end justify-between gap-3">
                <Avatar
                  seed={community.avatar}
                  size="2xl"
                  square
                  name={community.name}
                  className="-mt-10 ring-4 ring-white"
                />
                <div className="flex items-center gap-1.5 pb-1">
                  <JoinButton community={community} size="md" />
                  <IconButton label="Share community" variant="soft" size="sm" onClick={() => void share()}>
                    <Share2 className="size-4" />
                  </IconButton>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <h1 className="flex items-center gap-1.5 text-[24px] font-bold tracking-[-0.032em] text-ink-900">
                  {community.name}
                  {community.verified && <VerifiedBadge className="size-[17px]" />}
                </h1>
                <AccessBadge kind={community.access.label} />
              </div>

              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-700">
                {community.description}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-500">
                <span className="flex items-center gap-1.5">
                  <Users className="size-4" />
                  {compact(community.members)} members
                </span>
                <span>Created {longDate(community.createdAt)}</span>
              </div>

              {joined && membership && (
                <div className="mt-3 flex items-center gap-2.5 rounded-[16px] bg-brand-600/10 px-3.5 py-2.5">
                  <BadgeCheck className="size-[18px] shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-brand-800">
                      Member #{membership.memberNumber}
                    </p>
                    <p className="text-[12px] text-brand-700/80">
                      {credential
                        ? `${community.credential?.name} · held in your ${
                            credential.custody === 'wallet' ? 'wallet' : 'MESH account'
                          }`
                        : 'Active membership'}
                    </p>
                  </div>
                  <Badge tone="success">Active</Badge>
                </div>
              )}

              {!joined && !access.granted && (
                <button
                  onClick={() => setUi({ joinCommunityId: community.id })}
                  className="mt-3 flex w-full items-center gap-2.5 panel px-3.5 py-2.5 text-left transition-colors hover:bg-ink-700/[0.05]"
                >
                  <Lock className="size-[18px] shrink-0 text-ink-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-ink-900">
                      This community has access requirements
                    </p>
                    <p className="truncate text-[12px] text-ink-500">
                      {access.conditions.map((c) => c.label).join(' or ')}
                    </p>
                  </div>
                </button>
              )}
            </div>
          </Card>

          <div className="px-3 lg:px-0">
            <PillTabs items={TABS} value={tab} onChange={setTab} />
          </div>

          {tab === 'posts' && (
            <div className="space-y-0 lg:space-y-3">
              {joined && (
                <div className="px-3 lg:px-0">
                  <PostComposer communityId={community.id} />
                </div>
              )}
              {posts.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<Users className="size-6" />}
                    title="No posts yet"
                    description={
                      joined
                        ? 'Start the conversation — post something for the community.'
                        : 'Join to see and add to the conversation.'
                    }
                    action={
                      joined ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            setUi({ composerOpen: true, composerCommunityId: community.id })
                          }
                        >
                          Create a post
                        </Button>
                      ) : undefined
                    }
                  />
                </Card>
              ) : (
                posts.map((post) => <PostCard key={post.id} post={post} />)
              )}
            </div>
          )}

          {tab === 'members' && (
            <Card className="p-2">
              {members.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </Card>
          )}

          {tab === 'about' && (
            <div className="space-y-3 px-3 lg:px-0">
              <Card className="p-4">
                <h2 className="text-[15px] font-bold text-ink-900">About</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-700">{community.about}</p>
              </Card>

              <Card className="p-4">
                <h2 className="text-[15px] font-bold text-ink-900">Access</h2>
                <p className="mt-1 text-[12.5px] text-ink-500">
                  {community.access.anyOf.length > 1
                    ? 'Meet any one of these to join.'
                    : 'To join this community:'}
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {access.conditions.map((row, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 panel-sm px-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold text-ink-900">
                          {row.label}
                        </span>
                        <span className="block text-[12px] text-ink-500">{row.detail}</span>
                      </span>
                      <Badge tone={row.met ? 'success' : 'neutral'}>
                        {row.met ? 'Met' : 'Not met'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-4">
                <h2 className="text-[15px] font-bold text-ink-900">Rules</h2>
                <ol className="mt-2.5 space-y-2">
                  {community.rules.map((rule, i) => (
                    <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug text-ink-700">
                      <span className="font-bold text-ink-400">{i + 1}.</span>
                      {rule}
                    </li>
                  ))}
                </ol>
              </Card>
            </div>
          )}

          {tab === 'collectibles' && (
            <Card className="p-3">
              {community.credential ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="overflow-hidden panel">
                    <Scene
                      kind={community.cover.scene}
                      tone={community.cover.tone}
                      rounded="rounded-none"
                      className="aspect-square"
                    />
                    <div className="p-2.5">
                      <p className="truncate text-[13px] font-bold text-ink-900">
                        {community.credential.name}
                      </p>
                      <p className="text-[11.5px] text-ink-500">
                        {compact(community.credential.supply)} supply
                      </p>
                      <Button
                        size="xs"
                        variant="subtle"
                        block
                        className="mt-2"
                        onClick={() => navigate('/marketplace')}
                      >
                        View in marketplace
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Gem className="size-6" />}
                  title="No collectibles"
                  description="This community does not issue a membership credential."
                />
              )}
            </Card>
          )}
        </div>
      </AppShell>
    </>
  )
}
