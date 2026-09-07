import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AtSign,
  Award,
  Bell,
  Coins,
  Heart,
  MessageCircle,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import type { Notification, NotificationKind } from '@/types'
import { selectCommunity, selectUser, useApp } from '@/store/appStore'
import { markAllNotificationsRead, markNotificationRead } from '@/store/actions'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { PillTabs } from '@/components/ui/Tabs'
import { EmptyState } from '@/components/ui/Feedback'
import { FollowButton } from '@/components/social/UserBits'

const ICONS: Record<NotificationKind, { icon: typeof Heart; className: string }> = {
  like: { icon: Heart, className: 'bg-rose-50 text-like' },
  comment: { icon: MessageCircle, className: 'bg-blue-50 text-blue-600' },
  follow: { icon: UserPlus, className: 'bg-brand-50 text-brand-600' },
  community_invite: { icon: Users, className: 'bg-violet-50 text-violet-600' },
  tip: { icon: Coins, className: 'bg-emerald-50 text-emerald-600' },
  badge: { icon: Award, className: 'bg-amber-50 text-amber-600' },
  wallet: { icon: Wallet, className: 'bg-ink-700/12 text-ink-600' },
  collect: { icon: Sparkles, className: 'bg-brand-50 text-brand-600' },
  mention: { icon: AtSign, className: 'bg-sky-50 text-sky-600' },
}

const FILTERS = [
  { id: 'all' as const, label: 'All' },
  { id: 'social' as const, label: 'Social' },
  { id: 'money' as const, label: 'Earnings' },
  { id: 'communities' as const, label: 'Communities' },
]

type Filter = (typeof FILTERS)[number]['id']

const GROUPS: Record<Filter, NotificationKind[] | null> = {
  all: null,
  social: ['like', 'comment', 'follow', 'mention'],
  money: ['tip', 'collect', 'wallet'],
  communities: ['community_invite', 'badge'],
}

export function NotificationsPage() {
  const state = useApp()
  const [filter, setFilter] = useState<Filter>('all')

  const kinds = GROUPS[filter]
  const notifications = state.notifications
    .filter((n) => !kinds || kinds.includes(n.kind))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

  const unread = state.notifications.filter((n) => !n.read).length

  return (
    <>
      <MobileTopBar title="Notifications" showLogo={false} />
      <AppShell>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-3 lg:px-0">
            <div className="hidden lg:block">
              <h1 className="text-[28px] font-bold tracking-[-0.032em] text-ink-900">
                Notifications
              </h1>
              <p className="mt-0.5 text-[13.5px] text-ink-500">
                {unread > 0 ? `${unread} unread` : 'You are all caught up'}
              </p>
            </div>
            {unread > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllNotificationsRead}>
                Mark all read
              </Button>
            )}
          </div>

          <div className="px-3 lg:px-0">
            <PillTabs items={FILTERS} value={filter} onChange={setFilter} />
          </div>

          <Card className="mesh-card-flush overflow-hidden p-1.5">
            {notifications.length === 0 ? (
              <EmptyState
                icon={<Bell className="size-6" />}
                title="Nothing here yet"
                description="Likes, comments, tips and invites will show up in this list."
              />
            ) : (
              notifications.map((notification) => (
                <NotificationRow key={notification.id} notification={notification} />
              ))
            )}
          </Card>
        </div>
      </AppShell>
    </>
  )
}

function NotificationRow({ notification }: { notification: Notification }) {
  const state = useApp()
  const navigate = useNavigate()
  const actor = notification.actorId ? selectUser(state, notification.actorId) : undefined
  const community = notification.communityId
    ? selectCommunity(state, notification.communityId)
    : undefined
  const { icon: Icon, className } = ICONS[notification.kind]

  const text = describe(notification, actor?.name, community?.name)
  const target = notification.postId
    ? `/post/${notification.postId}`
    : community
      ? `/c/${community.slug}`
      : actor
        ? `/u/${actor.handle}`
        : '/wallet'

  return (
    <button
      onClick={() => {
        markNotificationRead(notification.id)
        navigate(target)
      }}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl px-2.5 py-3 text-left transition-colors',
        notification.read ? 'hover:bg-ink-700/[0.05]' : 'bg-brand-600/[0.07] hover:bg-brand-600/12',
      )}
    >
      <span className="relative shrink-0">
        {actor ? (
          <Avatar seed={actor.avatar} size="lg" name={actor.name} />
        ) : community ? (
          <Avatar seed={community.avatar} size="lg" square name={community.name} />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-full bg-ink-700/8">
            <Wallet className="size-5 text-ink-500" />
          </span>
        )}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full ring-2 ring-white',
            className,
          )}
        >
          <Icon className="size-3" fill={notification.kind === 'like' ? 'currentColor' : 'none'} />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[14px] leading-snug text-ink-800">{text}</span>
        <span className="mt-0.5 block text-[12px] text-ink-500">
          {timeAgo(notification.createdAt)}
        </span>
      </span>

      {notification.kind === 'follow' && actor && (
        <span onClick={(e) => e.stopPropagation()}>
          <FollowButton userId={actor.id} />
        </span>
      )}

      {notification.kind === 'community_invite' && community && (
        <Link
          to={`/c/${community.slug}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <Button size="sm" pill variant="subtle">
            View
          </Button>
        </Link>
      )}

      {!notification.read && (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />
      )}
    </button>
  )
}

function describe(notification: Notification, actorName?: string, communityName?: string) {
  const name = <strong className="font-bold text-ink-900">{actorName}</strong>
  switch (notification.kind) {
    case 'like':
      return <>{name} liked your post</>
    case 'comment':
      return <>{name} commented on your post</>
    case 'follow':
      return <>{name} followed you</>
    case 'mention':
      return <>{name} mentioned you in a post</>
    case 'community_invite':
      return (
        <>
          {name} invited you to <strong className="font-bold text-ink-900">{communityName}</strong>
        </>
      )
    case 'tip':
      return (
        <>
          {name} sent you a tip{notification.text ? ' of ' : ''}
          {notification.text && (
            <strong className="font-bold text-ink-900">{notification.text}</strong>
          )}
        </>
      )
    case 'collect':
      return <>{name} collected your post</>
    case 'badge':
      return (
        <>
          You earned <strong className="font-bold text-ink-900">{notification.badge}</strong>
          {notification.text ? ` — ${notification.text}` : ''}
        </>
      )
    case 'wallet':
      return <>{notification.text}</>
  }
}
