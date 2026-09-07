import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bookmark,
  CalendarDays,
  Coins,
  Flag,
  Heart,
  Link2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share2,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { cn, compact, longDate, usd } from '@/lib/utils'
import type { Post } from '@/types'
import {
  isFollowing,
  selectCommunity,
  selectUser,
  setUi,
  useApp,
} from '@/store/appStore'
import {
  deletePost,
  toggleAttending,
  toggleBookmark,
  toggleFollow,
  toggleLike,
  toggleRepost,
  toast,
  votePoll,
} from '@/store/actions'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Menu, MenuDivider, MenuItem } from '@/components/ui/Menu'
import { Scene } from '@/components/social/Scene'
import { PostByline } from '@/components/social/UserBits'
import { LogoMark } from '@/components/brand/Logo'
import { TokenAttachmentCard } from '@/features/pons/TokenAttachmentCard'
import { CommentsSheet } from './CommentsSheet'

export function PostCard({
  post,
  variant = 'card',
}: {
  post: Post
  variant?: 'card' | 'flat' | 'detail'
}) {
  const state = useApp()
  const navigate = useNavigate()
  const author = selectUser(state, post.authorId)
  const community = post.communityId ? selectCommunity(state, post.communityId) : undefined
  const isMine = post.authorId === state.me?.id
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [justLiked, setJustLiked] = useState(false)

  const like = () => {
    if (!post.likedByMe) {
      setJustLiked(true)
      setTimeout(() => setJustLiked(false), 400)
    }
    toggleLike(post.id)
  }

  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copied', description: 'Post link is on your clipboard.', tone: 'default', icon: 'check' })
    } catch {
      toast({ title: 'Could not copy link', tone: 'error', icon: 'alert' })
    }
  }

  return (
    <>
      <article
        className={cn(
          'group',
          // Full-bleed on mobile, a floating card from the lg breakpoint up.
          variant === 'card' &&
            'mesh-card-flush overflow-hidden',
          variant === 'flat' && 'hairline bg-white',
          variant === 'detail' && 'bg-white',
        )}
      >
        <div className="flex items-start gap-3 px-4 pt-3.5">
          <Link to={`/u/${author.handle}`} className="shrink-0">
            <Avatar seed={author.avatar} size="md" name={author.name} />
          </Link>

          <div className="min-w-0 flex-1">
            <PostByline
              user={author}
              createdAt={post.createdAt}
              subtitle={
                community
                  ? `posted in ${community.name}`
                  : post.audience === 'followers'
                    ? 'Followers only'
                    : post.audience === 'private'
                      ? 'Only you'
                      : undefined
              }
            />
          </div>

          <Menu
            trigger={({ toggle }) => (
              <IconButton
                label="Post options"
                size="sm"
                onClick={toggle}
                className="-mr-1 opacity-60 group-hover:opacity-100"
              >
                <MoreHorizontal className="size-[18px]" />
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
                  Copy link
                </MenuItem>
                <MenuItem
                  icon={<Bookmark className="size-4" />}
                  onClick={() => {
                    close()
                    toggleBookmark(post.id)
                  }}
                >
                  {post.bookmarkedByMe ? 'Remove from saved' : 'Save post'}
                </MenuItem>
                {!isMine && (
                  <MenuItem
                    icon={
                      isFollowing(state, author.id) ? (
                        <UserMinus className="size-4" />
                      ) : (
                        <UserPlus className="size-4" />
                      )
                    }
                    onClick={() => {
                      close()
                      toggleFollow(author.id)
                    }}
                  >
                    {isFollowing(state, author.id)
                      ? `Unfollow @${author.handle}`
                      : `Follow @${author.handle}`}
                  </MenuItem>
                )}
                <MenuDivider />
                {isMine ? (
                  <MenuItem
                    icon={<Trash2 className="size-4" />}
                    danger
                    onClick={() => {
                      close()
                      deletePost(post.id)
                    }}
                  >
                    Delete post
                  </MenuItem>
                ) : (
                  <MenuItem
                    icon={<Flag className="size-4" />}
                    danger
                    onClick={() => {
                      close()
                      toast({ title: 'Report submitted', description: 'Our team will take a look.', tone: 'default', icon: 'check' })
                    }}
                  >
                    Report post
                  </MenuItem>
                )}
              </>
            )}
          </Menu>
        </div>

        {post.text && (
          <div
            className={cn(
              'px-4 pt-2 whitespace-pre-line tracking-[-0.011em] text-ink-800',
              variant === 'detail' ? 'text-[17px] leading-[1.5]' : 'text-[15px] leading-[1.47]',
            )}
          >
            {post.text}
          </div>
        )}

        {post.location && (
          <div className="flex items-center gap-1.5 px-4 pt-2 text-[12.5px] text-ink-500">
            <MapPin className="size-3.5" />
            {post.location}
          </div>
        )}

        {post.media && (
          <button
            onClick={() => navigate(`/post/${post.id}`)}
            className="mt-3 block w-full px-4 text-left"
          >
            {post.media.src ? (
              <div className="media-ring relative overflow-hidden rounded-[18px]">
                {post.media.kind === 'video' ? (
                  <video
                    src={post.media.src}
                    className="aspect-[16/10] w-full object-cover"
                    controls
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <img src={post.media.src} alt="" className="aspect-[16/10] w-full object-cover" />
                )}
              </div>
            ) : (
            <Scene
              kind={post.media.scene}
              tone={post.media.tone}
              rounded="rounded-[18px]"
              className="media-ring aspect-[16/10] w-full"
              overlay={post.media.caption ? 'bottom' : 'none'}
            >
              {(post.media.overline || post.media.caption) && (
                <div className="absolute inset-x-5 bottom-5">
                  {post.media.overline && (
                    <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/85">
                      {post.media.overline}
                    </p>
                  )}
                  {post.media.caption && (
                    <p className="mt-1 text-[28px] font-bold leading-[1.1] tracking-[-0.035em] text-white">
                      {post.media.caption}
                    </p>
                  )}
                </div>
              )}
              <div className="glass-dark absolute bottom-3.5 right-3.5 flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5">
                <LogoMark tone="mono" className="size-[14px] text-white" />
                <span className="text-[10.5px] font-bold tracking-[-0.02em] text-white">MESH</span>
              </div>
            </Scene>
            )}
          </button>
        )}

        {post.token && <TokenAttachmentCard token={post.token} />}
        {post.poll && <PollBlock post={post} />}
        {post.event && <EventBlock post={post} />}
        {post.collectible && <CollectStrip post={post} isMine={isMine} />}

        {/* Action row */}
        <div className="flex items-center gap-1 px-3 py-2.5">
          <ActionButton
            label={post.likedByMe ? 'Unlike' : 'Like'}
            onClick={like}
            active={post.likedByMe}
            activeClass="text-like"
          >
            <Heart
              className={cn('size-[19px]', justLiked && 'animate-[var(--animate-heart)]')}
              fill={post.likedByMe ? 'currentColor' : 'none'}
              strokeWidth={post.likedByMe ? 0 : 2}
            />
            {compact(post.likes)}
          </ActionButton>

          <ActionButton label="Comments" onClick={() => setCommentsOpen(true)}>
            <MessageCircle className="size-[19px]" />
            {compact(post.comments)}
          </ActionButton>

          <ActionButton
            label={post.repostedByMe ? 'Undo repost' : 'Repost'}
            onClick={() => toggleRepost(post.id)}
            active={post.repostedByMe}
            activeClass="text-emerald-600"
          >
            <Repeat2 className="size-[20px]" />
            {compact(post.reposts)}
          </ActionButton>

          <div className="flex-1" />

          {!isMine && (
            <Button
              size="xs"
              pill
              variant="subtle"
              icon={<Coins className="size-[15px]" />}
              onClick={() => setUi({ tipTarget: { userId: author.id, postId: post.id } })}
            >
              Tip
            </Button>
          )}

          <IconButton
            label={post.bookmarkedByMe ? 'Remove from saved' : 'Save post'}
            size="sm"
            onClick={() => toggleBookmark(post.id)}
            className={cn(post.bookmarkedByMe && 'text-brand-600')}
          >
            <Bookmark
              className="size-[18px]"
              fill={post.bookmarkedByMe ? 'currentColor' : 'none'}
              strokeWidth={post.bookmarkedByMe ? 0 : 2}
            />
          </IconButton>

          <IconButton label="Share post" size="sm" onClick={() => void share()}>
            <Share2 className="size-[17px]" />
          </IconButton>
        </div>

        {variant === 'detail' && (
          <div className="hairline-t px-4 py-3 text-[12.5px] text-ink-500">
            {longDate(post.createdAt)} · {compact(post.likes)} likes ·{' '}
            {compact(post.reposts)} reposts
          </div>
        )}
      </article>

      <CommentsSheet post={post} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </>
  )
}

function ActionButton({
  children,
  label,
  onClick,
  active,
  activeClass,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  activeClass?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold tabular-nums',
        'transition-all duration-200 [transition-timing-function:var(--ease-tap)] active:scale-90',
        active ? activeClass : 'text-ink-500 hover:bg-ink-700/8 hover:text-ink-800',
      )}
    >
      {children}
    </button>
  )
}

/* --------------------------------- Blocks -------------------------------- */

function PollBlock({ post }: { post: Post }) {
  const poll = post.poll!
  const total = poll.options.reduce((s, o) => s + o.votes, 0)
  const voted = !!poll.votedOptionId

  return (
    <div className="mt-3 space-y-1.5 px-4">
      {poll.options.map((option) => {
        const pct = total ? Math.round((option.votes / total) * 100) : 0
        const mine = poll.votedOptionId === option.id
        return (
          <button
            key={option.id}
            onClick={() => votePoll(post.id, option.id)}
            disabled={voted}
            className={cn(
              'relative w-full overflow-hidden rounded-[12px] px-3 py-2.5 text-left transition-all duration-200',
              voted
                ? 'cursor-default shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.1)]'
                : 'shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.1)] hover:bg-brand-600/8 active:scale-[0.99]',
              mine && 'shadow-[inset_0_0_0_1.5px_var(--color-brand-500)]',
            )}
          >
            {voted && (
              <span
                className={cn(
                  'absolute inset-y-0 left-0 transition-[width] duration-500',
                  mine ? 'bg-brand-600/16' : 'bg-ink-700/8',
                )}
                style={{ width: `${pct}%` }}
              />
            )}
            <span className="relative flex items-center justify-between gap-3">
              <span
                className={cn(
                  'truncate text-[13.5px] font-semibold',
                  mine ? 'text-brand-700' : 'text-ink-800',
                )}
              >
                {option.label}
              </span>
              {voted && (
                <span className="shrink-0 text-[13px] font-bold text-ink-600">{pct}%</span>
              )}
            </span>
          </button>
        )
      })}
      <p className="pt-0.5 text-[12px] text-ink-500">
        {compact(total)} votes · {voted ? 'You voted' : 'Tap to vote'}
      </p>
    </div>
  )
}

function EventBlock({ post }: { post: Post }) {
  const event = post.event!
  const date = new Date(event.startsAt)

  return (
    <div className="mt-3 px-4">
      <div className="flex items-center gap-3 rounded-[16px] bg-ink-700/[0.05] p-3 shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.07)]">
        <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-center shadow-[var(--shadow-card)]">
          <span className="text-[10px] font-bold uppercase tracking-wide text-like">
            {date.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-[18px] font-bold leading-none tracking-[-0.02em] text-ink-900">
            {date.getDate()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-ink-900">{event.title}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
            <span className="flex items-center gap-1 truncate">
              <MapPin className="size-3.5 shrink-0" />
              {event.location}
            </span>
          </p>
          <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-ink-500">
            <Users className="size-3.5" />
            {compact(event.attending)} going
          </p>
        </div>
        <Button
          size="sm"
          pill
          variant={event.isAttending ? 'secondary' : 'primary'}
          onClick={() => toggleAttending(post.id)}
        >
          {event.isAttending ? 'Going' : 'Attend'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Creator-economy strip. Authors see what a post has earned; everyone else
 * sees the collect price and how many people already collected.
 */
function CollectStrip({ post, isMine }: { post: Post; isMine: boolean }) {
  const collect = post.collectible!

  return (
    <div className="mt-3 px-4">
      <div className="flex items-center gap-3 rounded-[16px] bg-brand-600/[0.08] px-3.5 py-2.5 shadow-[inset_0_0_0_0.5px_rgb(88_86_214/0.18)]">
        <Sparkles className="size-[18px] shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          {isMine ? (
            <>
              <p className="text-[13.5px] font-bold text-ink-900">
                {usd(collect.earned)} earned
              </p>
              <p className="text-[12px] text-ink-500">
                {compact(collect.collectors)} collectors
                {collect.edition ? ` · edition of ${compact(collect.edition)}` : ''}
              </p>
            </>
          ) : (
            <>
              <p className="text-[13.5px] font-bold text-ink-900">
                Collect this post · {collect.price} {collect.asset}
              </p>
              <p className="text-[12px] text-ink-500">
                {compact(collect.collectors)} collectors
                {collect.edition ? ` · ${compact(collect.edition - collect.collectors)} left` : ''}
              </p>
            </>
          )}
        </div>
        {isMine ? (
          <Badge tone="brand">Collectible</Badge>
        ) : collect.collectedByMe ? (
          <Badge tone="success">Collected</Badge>
        ) : (
          <Button size="sm" pill onClick={() => setUi({ collectPostId: post.id })}>
            Collect
          </Button>
        )}
      </div>
    </div>
  )
}

