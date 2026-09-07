import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  CalendarDays,
  Coins,
  Gem,
  Link2,
  Mail,
  MapPin,
  MoreHorizontal,
  Share2,
  Star,
  UserMinus,
  Users,
} from 'lucide-react'
import { compact, monthYear, usd } from '@/lib/utils'
import {
  isFollowing,
  selectCreatorStats,
  selectMyCommunities,
  selectUserByHandle,
  selectUserPosts,
  setUi,
  useApp,
} from '@/store/appStore'
import { loadProfile, openConversationWith, toast, toggleFollow } from '@/store/actions'
import { ReputationService } from '@/services/blockchain'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, DemoAccountBadge, VerifiedBadge } from '@/components/ui/Badge'
import { PillTabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/Feedback'
import { Menu, MenuItem } from '@/components/ui/Menu'
import { Scene } from '@/components/social/Scene'
import { StatPair } from '@/components/social/UserBits'
import { CommunityRow } from '@/components/social/CommunityBits'
import { PostCard } from '@/features/feed/PostCard'

type ProfileTab = 'posts' | 'media' | 'communities' | 'collectibles' | 'about'

const TABS = [
  { id: 'posts' as const, label: 'Posts' },
  { id: 'media' as const, label: 'Media' },
  { id: 'communities' as const, label: 'Communities' },
  { id: 'collectibles' as const, label: 'Collectibles' },
  { id: 'about' as const, label: 'About' },
]

export function ProfilePage() {
  const { handle = '' } = useParams()
  const state = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState<ProfileTab>('posts')

  const [missing, setMissing] = useState(false)
  const user = selectUserByHandle(state, handle)

  // Always re-read from the server: cached counts go stale as people post.
  useEffect(() => {
    let cancelled = false
    void loadProfile(handle).then((found) => {
      if (!cancelled && !found) setMissing(true)
    })
    return () => {
      cancelled = true
    }
  }, [handle])

  if (missing && !user) return <Navigate to="/explore?tab=people" replace />
  if (!user) return null

  const isMe = user.id === state.me?.id
  const following = isFollowing(state, user.id)
  const posts = selectUserPosts(state, user.id)
  const mediaPosts = posts.filter((p) => p.media)
  const stats = selectCreatorStats(state, user.id)
  const reputation = ReputationService.breakdown(user, {
    communities: isMe ? state.memberships.length : 0,
    collectibles: isMe ? state.collectibles.length : 0,
  })
  const tier = ReputationService.tier(user.reputation)
  const communities = isMe ? selectMyCommunities(state) : state.communities.slice(0, 3)
  const collectibles = isMe ? state.collectibles : []

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${user.handle}`)
      toast({ title: 'Profile link copied', tone: 'default', icon: 'check' })
    } catch {
      toast({ title: 'Could not copy link', tone: 'error', icon: 'alert' })
    }
  }

  return (
    <>
      <MobileTopBar title={user.name} showLogo={false} />
      <AppShell>
        <div className="space-y-3">
          <Card className="mesh-card-flush overflow-hidden">
            <Scene
              kind={user.cover.scene}
              tone={user.cover.tone}
              rounded="rounded-none"
              className="h-32 sm:h-44"
            />

            <div className="px-4 pb-4">
              <div className="flex items-end justify-between gap-3">
                <Avatar
                  seed={user.avatar}
                  size="2xl"
                  name={user.name}
                  className="-mt-12 ring-4 ring-white sm:size-[104px]"
                />

                <div className="flex items-center gap-1.5 pb-1">
                  {isMe ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate('/settings')}
                      >
                        Edit Profile
                      </Button>
                      <IconButton label="Share profile" variant="soft" size="sm" onClick={() => void share()}>
                        <Share2 className="size-4" />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        pill
                        variant={following ? 'secondary' : 'primary'}
                        onClick={() => toggleFollow(user.id)}
                      >
                        {following ? 'Following' : 'Follow'}
                      </Button>
                      <Button
                        size="sm"
                        pill
                        variant="secondary"
                        icon={<Mail className="size-4" />}
                        onClick={async () => {
                          const id = await openConversationWith(user.id)
                          if (id) navigate(`/messages/${id}`)
                        }}
                      >
                        Message
                      </Button>
                      <Button
                        size="sm"
                        pill
                        variant="subtle"
                        icon={<Coins className="size-4" />}
                        onClick={() => setUi({ tipTarget: { userId: user.id } })}
                      >
                        Tip
                      </Button>
                    </>
                  )}

                  <Menu
                    trigger={({ toggle }) => (
                      <IconButton label="More options" variant="soft" size="sm" onClick={toggle}>
                        <MoreHorizontal className="size-4" />
                      </IconButton>
                    )}
                  >
                    {(close) => (
                      <>
                        <MenuItem
                          icon={<Link2 className="size-4" />}
                          onClick={() => {
                            close()
                            void share()
                          }}
                        >
                          Copy profile link
                        </MenuItem>
                        {!isMe && following && (
                          <MenuItem
                            icon={<UserMinus className="size-4" />}
                            danger
                            onClick={() => {
                              close()
                              toggleFollow(user.id)
                            }}
                          >
                            Unfollow @{user.handle}
                          </MenuItem>
                        )}
                      </>
                    )}
                  </Menu>
                </div>
              </div>

              <div className="mt-3">
                <h1 className="flex items-center gap-1.5 text-[25px] font-bold tracking-[-0.032em] text-ink-900">
                  {user.name}
                  {user.verified && <VerifiedBadge className="size-[18px]" />}
                </h1>
                <p className="flex items-center gap-2 text-[14px] text-ink-500">
                  <span>@{user.handle}</span>
                  {user.isDemo && <DemoAccountBadge />}
                </p>
                {user.isDemo && (
                  <p className="mt-2 rounded-[12px] bg-ink-700/[0.06] px-3 py-2 text-[12.5px] leading-snug text-ink-600">
                    A fictional account seeded into this instance so the feed is not empty. It
                    cannot be signed into and never replies to messages.
                  </p>
                )}
              </div>

              <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink-700">
                {user.bio}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-500">
                {user.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {user.location}
                  </span>
                )}
                {user.website && (
                  <a
                    href={`https://${user.website}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 font-medium text-brand-600 hover:underline"
                  >
                    <Link2 className="size-4" />
                    {user.website}
                  </a>
                )}
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  Joined {monthYear(user.joinedAt)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-1 hairline-t pt-3.5">
                <StatPair value={user.followers} label="Followers" />
                <StatPair value={user.following} label="Following" />
                <StatPair value={user.postCount} label="Posts" />
                <StatPair value={user.reputation} label="Reputation" />
              </div>
            </div>
          </Card>

          <div className="px-3 lg:px-0">
            <PillTabs items={TABS} value={tab} onChange={setTab} />
          </div>

          {tab === 'posts' && (
            <div className="space-y-0 lg:space-y-3">
              {posts.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<Users className="size-6" />}
                    title="No posts yet"
                    description={
                      isMe ? 'Share your first post with the network.' : `@${user.handle} hasn’t posted yet.`
                    }
                    action={
                      isMe ? (
                        <Button size="sm" onClick={() => setUi({ composerOpen: true })}>
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

          {tab === 'media' && (
            <Card className="p-3">
              {mediaPosts.length === 0 ? (
                <EmptyState icon={<Gem className="size-6" />} title="No media yet" />
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {mediaPosts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="group overflow-hidden rounded-xl"
                    >
                      {post.media!.src ? (
                        <img
                          src={post.media!.src}
                          alt=""
                          className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <Scene
                          kind={post.media!.scene}
                          tone={post.media!.tone}
                          rounded="rounded-xl"
                          className="aspect-square transition-transform group-hover:scale-105"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'communities' && (
            <Card className="p-2">
              {communities.length === 0 ? (
                <EmptyState
                  icon={<Users className="size-6" />}
                  title="No communities yet"
                  description="Communities you join will show up here."
                />
              ) : (
                communities.map((community) => (
                  <CommunityRow key={community.id} community={community} showDescription />
                ))
              )}
            </Card>
          )}

          {tab === 'collectibles' && (
            <Card className="p-3">
              {collectibles.length === 0 ? (
                <EmptyState
                  icon={<Gem className="size-6" />}
                  title={isMe ? 'Nothing collected yet' : 'Collectibles are private'}
                  description={
                    isMe
                      ? 'Collect a post or buy from the marketplace to start a collection.'
                      : 'This account has not made its collection public.'
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {collectibles.map((item) => (
                    <div key={item.id} className="overflow-hidden panel">
                      <Scene kind={item.scene} tone={item.tone} rounded="rounded-none" className="aspect-square" />
                      <div className="p-2.5">
                        <p className="truncate text-[13px] font-bold text-ink-900">{item.name}</p>
                        <p className="truncate text-[11.5px] text-ink-500">{item.collection}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'about' && (
            <div className="space-y-3">
              <Card className="p-4">
                <h2 className="text-[15px] font-bold text-ink-900">About</h2>
                <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink-700">
                  {user.bio}
                </p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
                    <Star className="size-4 text-amber-500" />
                    Reputation {user.reputation}
                  </h2>
                  <Badge tone={reputation.source === 'demo' ? 'warn' : 'success'}>
                    {tier.label}
                  </Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-500">
                  {tier.hint} ·{' '}
                  {reputation.source === 'demo'
                    ? 'demo score, not computed onchain'
                    : 'computed from onchain attestations'}
                </p>
                <ul className="mt-3 space-y-2">
                  {reputation.factors.map((factor) => (
                    <li key={factor.label} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-ink-800">
                          {factor.label}
                        </span>
                        <span className="block text-[12px] text-ink-500">{factor.hint}</span>
                      </span>
                      <span className="text-[13px] font-bold tabular-nums text-ink-700">
                        +{factor.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>

              {isMe && (
                <Card className="p-4">
                  <h2 className="text-[15px] font-bold text-ink-900">Creator activity</h2>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <StatPair value={stats.posts} label="Posts" />
                    <StatPair value={stats.likes} label="Likes" />
                    <StatPair value={stats.collectors} label="Collectors" />
                    <StatPair value={usd(stats.earned, { cents: false })} label="Earned" />
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <h2 className="text-[15px] font-bold text-ink-900">Identity</h2>
                <dl className="mt-3 space-y-2 text-[13px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">MESH handle</dt>
                    <dd className="font-semibold text-ink-800">@{user.handle}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">Member since</dt>
                    <dd className="font-semibold text-ink-800">{monthYear(user.joinedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">Collectibles held</dt>
                    <dd className="font-semibold text-ink-800">{compact(isMe ? state.collectibles.length : 0)}</dd>
                  </div>
                </dl>
              </Card>
            </div>
          )}
        </div>
      </AppShell>
    </>
  )
}
