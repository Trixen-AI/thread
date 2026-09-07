import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import {
  selectCurrentUser,
  selectStories,
  selectUser,
  setUi,
  useApp,
  type StoryCard,
} from '@/store/appStore'
import { closeStory, openStory } from '@/store/actions'
import { Avatar } from '@/components/ui/Avatar'
import { Scene } from '@/components/social/Scene'
import { IconButton, Button } from '@/components/ui/Button'

/**
 * Highlights rail.
 *
 * Each card is a real post with artwork, newest first; the leading card starts
 * a new post. Tapping through opens the underlying post, so nothing in the rail
 * is content that does not exist.
 */
export function StoryCards() {
  const state = useApp()
  const stories = selectStories(state)
  const me = selectCurrentUser(state)

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-2 pb-1">
      <button
        onClick={() => setUi({ composerOpen: true })}
        className="group relative h-[124px] w-[74px] shrink-0 overflow-hidden rounded-2xl bg-ink-700/8 transition-transform active:scale-[0.97]"
      >
        <span className="absolute left-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-white">
          <Plus className="size-4" strokeWidth={3} />
        </span>
        <span className="absolute inset-x-1.5 bottom-1.5 truncate text-left text-[11px] font-semibold text-ink-600">
          New post
        </span>
      </button>

      {stories.map((story, index) => {
        const author = selectUser(state, story.authorId)
        return (
          <button
            key={story.id}
            onClick={() => openStory(index)}
            className="group relative h-[124px] w-[74px] shrink-0 overflow-hidden rounded-2xl transition-transform active:scale-[0.97]"
          >
            <Scene
              kind={story.scene}
              tone={story.tone}
              rounded="rounded-2xl"
              overlay="bottom"
              fill
              className="transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute left-1.5 top-1.5">
              <Avatar
                seed={author.avatar}
                size="sm"
                name={author.name}
                className={cn('ring-2', author.id === me.id ? 'ring-brand-500' : 'ring-white/80')}
              />
            </span>
            <span className="absolute inset-x-1.5 bottom-1.5 truncate text-left text-[11px] font-semibold tracking-[-0.01em] text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.5)]">
              {author.name.split(' ')[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Circular rail — mobile home screen. */
export function StoryRail({ className }: { className?: string }) {
  const state = useApp()
  const stories = selectStories(state)
  const me = selectCurrentUser(state)

  return (
    <div className={cn('no-scrollbar flex gap-3.5 overflow-x-auto px-4 py-3', className)}>
      <button
        onClick={() => setUi({ composerOpen: true })}
        className="flex w-[62px] shrink-0 flex-col items-center gap-1.5"
      >
        <span className="relative flex size-[62px] items-center justify-center rounded-full bg-ink-700/10 p-[2.5px] transition-transform active:scale-95">
          <span className="flex size-full items-center justify-center rounded-full bg-white p-[2px]">
            <Avatar seed={me.avatar} size="lg" name={me.name} className="size-full" />
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-white">
            <Plus className="size-3" strokeWidth={3} />
          </span>
        </span>
        <span className="w-full truncate text-center text-[11.5px] font-medium text-ink-600">
          New post
        </span>
      </button>

      {stories.map((story, index) => {
        const author = selectUser(state, story.authorId)
        return (
          <button
            key={story.id}
            onClick={() => openStory(index)}
            className="flex w-[62px] shrink-0 flex-col items-center gap-1.5"
          >
            <span className="relative flex size-[62px] items-center justify-center rounded-full bg-[conic-gradient(from_210deg,#5856D6,#8D8AE9,#FF2D55,#5856D6)] p-[2.5px] transition-transform active:scale-95">
              <span className="flex size-full items-center justify-center rounded-full bg-white p-[2px]">
                <Avatar seed={author.avatar} size="lg" name={author.name} className="size-full" />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11.5px] font-medium text-ink-600">
              {author.name.split(' ')[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Full-screen viewer with segment progress; advances on tap or timer. */
export function StoryViewer() {
  const state = useApp()
  const navigate = useNavigate()
  const stories = selectStories(state)
  const index = state.ui.storyIndex
  const [progress, setProgress] = useState(0)
  const story: StoryCard | undefined = index === null ? undefined : stories[index]

  const advance = (delta: number) => {
    if (index === null) return
    const next = index + delta
    if (next < 0) return
    if (next >= stories.length) closeStory()
    else openStory(next)
  }

  useEffect(() => {
    if (index === null) return
    setProgress(0)
    const started = Date.now()
    const timer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / 6000) * 100)
      setProgress(pct)
      if (pct >= 100) {
        clearInterval(timer)
        advance(1)
      }
    }, 60)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, stories.length])

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeStory()
      if (e.key === 'ArrowRight') advance(1)
      if (e.key === 'ArrowLeft') advance(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  if (index === null || !story) return null
  const author = selectUser(state, story.authorId)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/90 animate-[var(--animate-fade-in)]">
      <div className="relative flex h-full w-full max-w-[420px] flex-col sm:h-[92vh] sm:overflow-hidden sm:rounded-3xl">
        <Scene
          kind={story.scene}
          tone={story.tone}
          rounded="rounded-none sm:rounded-3xl"
          overlay="bottom"
          fill
        />

        <div className="relative flex gap-1 px-3 pt-3">
          {stories.map((_, i) => (
            <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full rounded-full bg-white transition-[width] duration-100"
                style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }}
              />
            </span>
          ))}
        </div>

        <div className="relative flex items-center gap-2.5 px-3 pt-3">
          <Avatar seed={author.avatar} size="sm" name={author.name} ring />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-bold text-white">{author.name}</p>
            <p className="text-[11.5px] text-white/70">{timeAgo(story.createdAt)}</p>
          </div>
          <IconButton
            label="Close"
            onClick={closeStory}
            className="text-white hover:bg-white/15"
          >
            <X className="size-5" />
          </IconButton>
        </div>

        <button
          aria-label="Previous"
          onClick={() => advance(-1)}
          className="relative flex-1 cursor-default"
        />
        <button
          aria-label="Next"
          onClick={() => advance(1)}
          className="absolute inset-y-16 right-0 w-1/2 cursor-default"
        />

        <div className="safe-bottom relative px-4 pb-5">
          {story.text && (
            <p className="line-clamp-3 text-[15px] leading-snug text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.6)]">
              {story.text}
            </p>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => {
              closeStory()
              navigate(`/post/${story.postId}`)
            }}
          >
            Open post
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
