import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hash, Search, TrendingUp, X } from 'lucide-react'
import { cn, compact } from '@/lib/utils'
import { useApp } from '@/store/appStore'
import { searchPeople } from '@/store/actions'
import { search } from '@/services/social/search'
import { Avatar } from '@/components/ui/Avatar'
import { VerifiedBadge } from '@/components/ui/Badge'

/**
 * Global search with a live result panel. Enter (or "See all results") goes to
 * the full search page; picking a result navigates straight there.
 */
export function SearchBox({
  className,
  placeholder = 'Search people, communities, or posts...',
  autoFocus,
}: {
  className?: string
  placeholder?: string
  autoFocus?: boolean
}) {
  const state = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => search(state, query, 4), [state, query])

  // The directory lives on the server, so a query has to reach it — the local
  // filter alone would only ever match accounts already cached.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) return
    const timer = setTimeout(() => void searchPeople(term), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const go = (to: string) => {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
    navigate(to)
  }

  const submit = () => {
    if (!query.trim()) return
    go(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  const showPanel = open && query.trim().length > 0

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3.5 size-[17px] text-ink-400" />
        <input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={placeholder}
          aria-label="Search MESH"
          className={cn(
            'h-10 w-full rounded-full bg-ink-700/[0.07] pl-10 pr-9 text-[15px] tracking-[-0.01em] text-ink-900',
            'shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.05)] placeholder:text-ink-400',
            'transition-all duration-200 hover:bg-ink-700/[0.1]',
            'focus:bg-white focus:shadow-[inset_0_0_0_1.5px_var(--color-brand-500)] focus:outline-none',
          )}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            className="absolute right-3 text-ink-400 hover:text-ink-600"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="glass-thick absolute inset-x-0 top-12 z-50 max-h-[70vh] overflow-y-auto scroll-slim rounded-[18px] p-2 shadow-[var(--shadow-pop)] animate-[var(--animate-pop-in)]">
          {results.total === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-ink-500">
              No results for “{query}”.
            </p>
          )}

          {results.people.length > 0 && <PanelLabel>People</PanelLabel>}
          {results.people.map((user) => (
            <button
              key={user.id}
              onClick={() => go(`/u/${user.handle}`)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-ink-700/[0.05]"
            >
              <Avatar seed={user.avatar} size="sm" name={user.name} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-[13.5px] font-semibold text-ink-900">
                  <span className="truncate">{user.name}</span>
                  {user.verified && <VerifiedBadge />}
                </span>
                <span className="block truncate text-[12px] text-ink-500">@{user.handle}</span>
              </span>
              <span className="shrink-0 text-[11.5px] text-ink-400">
                {compact(user.followers)}
              </span>
            </button>
          ))}

          {results.communities.length > 0 && <PanelLabel>Communities</PanelLabel>}
          {results.communities.map((community) => (
            <button
              key={community.id}
              onClick={() => go(`/c/${community.slug}`)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-ink-700/[0.05]"
            >
              <Avatar seed={community.avatar} size="sm" square name={community.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink-900">
                  {community.name}
                </span>
                <span className="block truncate text-[12px] text-ink-500">
                  {compact(community.members)} members
                </span>
              </span>
            </button>
          ))}

          {results.trends.length > 0 && <PanelLabel>Topics</PanelLabel>}
          {results.trends.map((trend) => (
            <button
              key={trend.id}
              onClick={() => go(`/search?q=${encodeURIComponent(trend.topic)}`)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-ink-700/[0.05]"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-ink-700/8 text-ink-500">
                {trend.topic.startsWith('#') ? (
                  <Hash className="size-4" />
                ) : (
                  <TrendingUp className="size-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink-900">
                  {trend.topic}
                </span>
                <span className="block text-[12px] text-ink-500">
                  {compact(trend.posts)} posts
                </span>
              </span>
            </button>
          ))}

          {results.posts.length > 0 && <PanelLabel>Posts</PanelLabel>}
          {results.posts.map((post) => (
            <button
              key={post.id}
              onClick={() => go(`/post/${post.id}`)}
              className="block w-full rounded-xl px-2.5 py-2 text-left hover:bg-ink-700/[0.05]"
            >
              <span className="line-clamp-2 text-[13px] leading-snug text-ink-700">
                {post.text}
              </span>
            </button>
          ))}

          {results.total > 0 && (
            <button
              onClick={submit}
              className="mt-1 w-full rounded-[12px] bg-brand-600/10 px-3 py-2.5 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-brand-600/16"
            >
              See all results for “{query}”
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const PanelLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">
    {children}
  </p>
)
