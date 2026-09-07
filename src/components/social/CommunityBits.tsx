import { Link } from 'react-router-dom'
import { cn, compact } from '@/lib/utils'
import type { Community } from '@/types'
import { isMember, setUi, useApp } from '@/store/appStore'
import { checkAccess, joinCommunity } from '@/store/actions'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { AccessBadge, VerifiedBadge } from '@/components/ui/Badge'
import { Scene } from './Scene'

/**
 * Join control. Open communities join immediately; gated ones open the access
 * sheet, which explains the requirement rather than just refusing.
 */
export function JoinButton({
  community,
  size = 'sm',
  className,
}: {
  community: Community
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const state = useApp()
  const joined = isMember(state, community.id)

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (joined) {
      setUi({ joinCommunityId: community.id })
      return
    }
    const access = checkAccess(community)
    if (access.granted) joinCommunity(community.id)
    else setUi({ joinCommunityId: community.id })
  }

  return (
    <Button
      size={size}
      pill
      variant={joined ? 'secondary' : 'subtle'}
      className={cn('min-w-[64px]', className)}
      onClick={onClick}
    >
      {joined ? 'Joined' : 'Join'}
    </Button>
  )
}

/** Compact list row — sidebar suggestions and the communities directory. */
export function CommunityRow({
  community,
  showDescription,
  className,
}: {
  community: Community
  showDescription?: boolean
  className?: string
}) {
  return (
    <Link
      to={`/c/${community.slug}`}
      className={cn(
        'flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-ink-700/[0.05]',
        className,
      )}
    >
      <Avatar seed={community.avatar} size="md" square name={community.name} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1 text-[14px] leading-tight">
          <span className="truncate font-bold text-ink-900">{community.name}</span>
          {community.verified && <VerifiedBadge />}
        </div>
        <div className="mt-0.5 text-[12.5px] text-ink-500">
          {compact(community.members)} members
        </div>
        {showDescription && (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-ink-500">
            {community.description}
          </p>
        )}
      </div>
      <JoinButton community={community} className="mt-0.5" />
    </Link>
  )
}

/** Cover-led card used in the communities grid and explore. */
export function CommunityCard({ community }: { community: Community }) {
  return (
    <Link
      to={`/c/${community.slug}`}
      className="mesh-card group block overflow-hidden transition-shadow hover:shadow-[var(--shadow-raise)]"
    >
      <Scene
        kind={community.cover.scene}
        tone={community.cover.tone}
        rounded="rounded-none"
        className="h-24"
      >
        <div className="absolute right-2.5 top-2.5">
          <AccessBadge kind={community.access.label} className="glass !text-ink-700" />
        </div>
      </Scene>
      <div className="p-3.5 pt-0">
        <Avatar
          seed={community.avatar}
          size="lg"
          square
          name={community.name}
          className="-mt-6 ring-[3px] ring-white"
        />
        <div className="mt-2 flex items-center gap-1">
          <h3 className="truncate text-[15px] font-bold tracking-tight text-ink-900">
            {community.name}
          </h3>
          {community.verified && <VerifiedBadge />}
        </div>
        <p className="mt-1 line-clamp-2 min-h-[34px] text-[12.5px] leading-snug text-ink-500">
          {community.description}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-ink-600">
            {compact(community.members)} members
          </span>
          <JoinButton community={community} />
        </div>
      </div>
    </Link>
  )
}
