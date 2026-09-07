import { Link } from 'react-router-dom'
import { cn, compact, full, timeAgo } from '@/lib/utils'
import type { User } from '@/types'
import { isFollowing, useApp } from '@/store/appStore'
import { toggleFollow } from '@/store/actions'
import { Avatar, type AvatarSize } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { DemoAccountBadge, VerifiedBadge } from '@/components/ui/Badge'

/** Display name + verification tick, linked to the profile. */
export function UserName({
  user,
  className,
  link = true,
}: {
  user: User
  className?: string
  link?: boolean
}) {
  const inner = (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <span className="truncate font-bold text-ink-900">{user.name}</span>
      {user.verified && <VerifiedBadge />}
    </span>
  )
  if (!link) return inner
  return (
    <Link to={`/u/${user.handle}`} className="min-w-0 hover:underline" onClick={stop}>
      {inner}
    </Link>
  )
}

const stop = (e: React.MouseEvent) => e.stopPropagation()

/** The `Name ✓ @handle · 2h` line at the top of every post. */
export function PostByline({
  user,
  createdAt,
  subtitle,
}: {
  user: User
  createdAt: string
  subtitle?: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1 text-[14.5px] leading-tight">
        <UserName user={user} />
        <Link
          to={`/u/${user.handle}`}
          onClick={stop}
          className="truncate text-ink-500 hover:underline"
        >
          @{user.handle}
        </Link>
        <span className="text-ink-400">·</span>
        <span className="shrink-0 text-ink-500">{timeAgo(createdAt)}</span>
      </div>
      {subtitle && <div className="mt-0.5 truncate text-[12.5px] text-ink-500">{subtitle}</div>}
    </div>
  )
}

export function FollowButton({
  userId,
  size = 'sm',
  className,
}: {
  userId: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const state = useApp()
  const following = isFollowing(state, userId)
  if (userId === state.me?.id) return null

  return (
    <Button
      size={size}
      pill
      variant={following ? 'secondary' : 'primary'}
      className={cn('min-w-[72px]', className)}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        toggleFollow(userId)
      }}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  )
}

/** Avatar + name + handle + Follow — the sidebar's "Suggested for you" row. */
export function UserRow({
  user,
  size = 'md',
  subtitle,
  action,
  className,
}: {
  user: User
  size?: AvatarSize
  subtitle?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={`/u/${user.handle}`}
      className={cn(
        'flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-ink-700/[0.05]',
        className,
      )}
    >
      <Avatar seed={user.avatar} size={size} name={user.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1 text-[14px] leading-tight">
          <span className="truncate font-bold text-ink-900">{user.name}</span>
          {user.verified && <VerifiedBadge />}
          {user.isDemo && <DemoAccountBadge className="ml-0.5" />}
        </div>
        <div className="truncate text-[12.5px] text-ink-500">
          {subtitle ?? `@${user.handle}`}
        </div>
      </div>
      {action ?? <FollowButton userId={user.id} />}
    </Link>
  )
}

export function StatPair({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-[18px] font-bold tracking-[-0.028em] text-ink-900">
        {/* Abbreviate only once the exact figure stops being readable. */}
        {typeof value === 'number' ? (value >= 10_000 ? compact(value) : full(value)) : value}
      </div>
      <div className="mt-0.5 text-[12px] font-medium text-ink-500">{label}</div>
    </div>
  )
}
