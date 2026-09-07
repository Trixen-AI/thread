import { BarChart3, CalendarDays, Gem, Image as ImageIcon, Video } from 'lucide-react'
import { selectCurrentUser, setUi, useApp } from '@/store/appStore'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'

const ACTIONS = [
  { label: 'Photo', icon: ImageIcon, className: 'text-success bg-success/14' },
  { label: 'Video', icon: Video, className: 'text-verified bg-verified/14' },
  { label: 'Poll', icon: BarChart3, className: 'text-brand-600 bg-brand-600/14' },
  { label: 'Event', icon: CalendarDays, className: 'text-warn bg-warn/16' },
  { label: 'NFT', icon: Gem, className: 'text-like bg-like/14' },
] as const

/**
 * The inline composer at the top of the feed. It is a launcher, not an editor —
 * every entry point opens the full composer with the right tool selected.
 */
export function PostComposer({ communityId }: { communityId?: string }) {
  const state = useApp()
  const me = selectCurrentUser(state)
  const open = () => setUi({ composerOpen: true, composerCommunityId: communityId })

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar seed={me.avatar} size="lg" name={me.name} />
        <button
          onClick={open}
          className="h-11 flex-1 rounded-full bg-ink-700/[0.06] px-4 text-left text-[15px] tracking-[-0.01em] text-ink-500 shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.05)] transition-colors duration-200 hover:bg-ink-700/[0.1]"
        >
          What’s on your mind, {me.name.split(' ')[0]}?
        </button>
      </div>

      <div className="no-scrollbar mt-3 flex gap-1 overflow-x-auto pt-3 shadow-[inset_0_0.5px_0_rgb(60_60_67/0.16)]">
        {ACTIONS.map(({ label, icon: Icon, className }) => (
          <button
            key={label}
            onClick={open}
            className="flex shrink-0 items-center gap-2 rounded-[12px] px-2.5 py-2 text-[13.5px] font-semibold tracking-[-0.01em] text-ink-600 transition-all duration-200 [transition-timing-function:var(--ease-tap)] hover:bg-ink-700/8 active:scale-[0.96]"
          >
            <span className={`flex size-[26px] items-center justify-center rounded-[8px] ${className}`}>
              <Icon className="size-[15px]" strokeWidth={2.2} />
            </span>
            {label}
          </button>
        ))}
      </div>
    </Card>
  )
}
