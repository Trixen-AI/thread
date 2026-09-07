import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Gem,
  Globe,
  ImagePlus,
  Lock,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostAudience, PostMedia, SceneKind, TokenSymbol } from '@/types'
import { SCENE_KINDS, sceneUrl } from '@/data/visuals'
import { selectCurrentUser, selectMyCommunities, setUi, useApp } from '@/store/appStore'
import { createPost } from '@/store/actions'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Field'
import { TokenLogo } from '@/features/pons/TokenBits'

type Tool = 'media' | 'poll' | 'event' | 'collect' | 'tag' | 'location' | null

const AUDIENCES: Array<{
  id: PostAudience
  label: string
  hint: string
  icon: typeof Globe
}> = [
  { id: 'everyone', label: 'Everyone', hint: 'Anyone on or off MESH', icon: Globe },
  { id: 'followers', label: 'Followers', hint: 'People who follow you', icon: Users },
  { id: 'community', label: 'Community', hint: 'Only members of one community', icon: Users },
  { id: 'private', label: 'Only me', hint: 'Visible to you alone', icon: Lock },
]

const MAX_LENGTH = 500

export function CreatePostModal() {
  const state = useApp()
  const me = selectCurrentUser(state)
  const myCommunities = selectMyCommunities(state)
  const open = state.ui.composerOpen

  const [text, setText] = useState('')
  const [media, setMedia] = useState<PostMedia | null>(null)
  const [tool, setTool] = useState<Tool>(null)
  const [audience, setAudience] = useState<PostAudience>('everyone')
  const [communityId, setCommunityId] = useState<string | undefined>()
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [event, setEvent] = useState({ title: '', startsAt: '', location: '' })
  const [collect, setCollect] = useState<{ price: string; asset: TokenSymbol } | null>(null)
  const [location, setLocation] = useState('')
  const [publishing, setPublishing] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Preset the community when the composer is opened from a community page.
  useEffect(() => {
    if (!open) return
    if (state.ui.composerCommunityId) {
      setAudience('community')
      setCommunityId(state.ui.composerCommunityId)
    }
    const t = setTimeout(() => textRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [open, state.ui.composerCommunityId])

  const reset = () => {
    setText('')
    setMedia(null)
    setTool(null)
    setAudience('everyone')
    setCommunityId(undefined)
    setPollOptions(['', ''])
    setEvent({ title: '', startsAt: '', location: '' })
    setCollect(null)
    setLocation('')
    setPublishing(false)
  }

  const close = () => {
    setUi({ composerOpen: false, composerCommunityId: undefined, composerToken: undefined })
    reset()
  }

  // A launch to attach — set when the composer opens from a token's thread.
  const token = state.ui.composerToken

  const validPoll = pollOptions.filter((o) => o.trim()).length >= 2
  const canPost =
    (text.trim().length > 0 || !!media || (tool === 'poll' && validPoll)) &&
    text.length <= MAX_LENGTH &&
    (audience !== 'community' || !!communityId)

  const publish = () => {
    if (!canPost || publishing) return
    setPublishing(true)
    const price = collect ? Number(collect.price) : 0
    createPost({
      text,
      media: media ?? undefined,
      audience,
      communityId: audience === 'community' ? communityId : undefined,
      poll:
        tool === 'poll' && validPoll
          ? {
              options: pollOptions
                .filter((o) => o.trim())
                .map((label, i) => ({ id: `o${i}`, label, votes: 0 })),
              endsAt: new Date(Date.now() + 86_400_000).toISOString(),
            }
          : undefined,
      event: event.title.trim()
        ? {
            title: event.title.trim(),
            startsAt: event.startsAt || new Date(Date.now() + 604_800_000).toISOString(),
            location: event.location.trim() || 'Online',
            attending: 0,
          }
        : undefined,
      collectible: collect && price > 0 ? { price, asset: collect.asset } : undefined,
      token: token ?? undefined,
      location: location.trim() || undefined,
    })
    close()
  }

  const attachFile = (file: File) => {
    const url = URL.createObjectURL(file)
    setMedia({
      kind: file.type.startsWith('video') ? 'video' : 'image',
      scene: 'bloom',
      tone: 0,
      src: url,
    })
  }

  const audienceMeta = AUDIENCES.find((a) => a.id === audience)!

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create Post"
      size="lg"
      footer={
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'text-[12px] font-medium tabular-nums',
              text.length > MAX_LENGTH ? 'text-danger' : 'text-ink-400',
            )}
          >
            {text.length}/{MAX_LENGTH}
          </span>
          <div className="flex-1" />
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={publish} disabled={!canPost} loading={publishing} className="min-w-[92px]">
            Post
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-3 pb-3">
        <Avatar seed={me.avatar} size="lg" name={me.name} />
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold text-ink-900">{me.name}</p>
          <p className="text-[12.5px] text-ink-500">@{me.handle}</p>
        </div>
      </div>

      {token && (
        <div className="mb-3 flex items-center gap-3 rounded-[14px] bg-brand-600/[0.08] px-3 py-2.5 shadow-[inset_0_0_0_0.5px_rgb(88_86_214/0.18)]">
          <TokenLogo logo={token.logo} symbol={token.symbol} address={token.address} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-bold text-ink-900">
              {token.name} <span className="text-ink-500">${token.symbol}</span>
            </p>
            <p className="text-[12px] text-ink-500">Posting in this token’s thread</p>
          </div>
          <button
            onClick={() => setUi({ composerToken: undefined })}
            aria-label="Detach token"
            className="flex size-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-700/8 hover:text-ink-800"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <textarea
        ref={textRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={token ? `What do you think about $${token.symbol}?` : 'What’s on your mind?'}
        rows={4}
        className="w-full resize-none border-0 bg-transparent text-[16px] leading-relaxed text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0"
      />

      {location && (
        <div className="flex flex-wrap gap-1.5 pb-3">
          {location && (
            <Badge tone="neutral" icon={<MapPin className="size-3" />}>
              {location}
            </Badge>
          )}
        </div>
      )}

      {/* Media */}
      <div className="space-y-2">
        {media && (
          <div className="relative overflow-hidden rounded-2xl">
            {media.src ? (
              media.kind === 'video' ? (
                <video src={media.src} className="aspect-[16/10] w-full object-cover" controls />
              ) : (
                <img src={media.src} alt="" className="aspect-[16/10] w-full object-cover" />
              )
            ) : (
              <div
                className="aspect-[16/10] w-full bg-cover bg-center"
                style={{ backgroundImage: sceneUrl(media.scene, media.tone) }}
              />
            )}
            <button
              onClick={() => setMedia(null)}
              aria-label="Remove media"
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-ink-950/60 text-white backdrop-blur hover:bg-ink-950/80"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {tool === 'media' && (
          <ToolPanel title="Add media" onClose={() => setTool(null)}>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink-300 text-ink-500 transition-colors hover:border-brand-400 hover:text-brand-600"
              >
                <Plus className="size-5" />
                <span className="text-[10.5px] font-semibold">Upload</span>
              </button>
              {SCENE_KINDS.map((scene, i) => (
                <SceneThumb
                  key={scene}
                  scene={scene}
                  tone={i}
                  selected={media?.scene === scene && !media.src}
                  onSelect={() => setMedia({ kind: 'image', scene, tone: i })}
                />
              ))}
            </div>
            <p className="pt-2 text-[12px] text-ink-500">
              Upload your own file, or pick generated artwork for this demo.
            </p>
          </ToolPanel>
        )}

        {tool === 'poll' && (
          <ToolPanel title="Poll" onClose={() => setTool(null)}>
            <div className="space-y-2">
              {pollOptions.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) =>
                      setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                    }
                    placeholder={`Option ${i + 1}`}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove option ${i + 1}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-700/8 hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <Button
                  size="sm"
                  variant="soft"
                  icon={<Plus className="size-4" />}
                  onClick={() => setPollOptions((prev) => [...prev, ''])}
                >
                  Add option
                </Button>
              )}
            </div>
          </ToolPanel>
        )}

        {tool === 'event' && (
          <ToolPanel title="Event" onClose={() => setTool(null)}>
            <div className="space-y-2">
              <Input
                value={event.title}
                onChange={(e) => setEvent({ ...event, title: e.target.value })}
                placeholder="Event name"
              />
              <Input
                type="datetime-local"
                value={event.startsAt}
                onChange={(e) => setEvent({ ...event, startsAt: e.target.value })}
              />
              <Input
                value={event.location}
                onChange={(e) => setEvent({ ...event, location: e.target.value })}
                placeholder="Location"
                leading={<MapPin className="size-4" />}
              />
            </div>
          </ToolPanel>
        )}

        {tool === 'collect' && (
          <ToolPanel title="Make collectible" onClose={() => setTool(null)}>
            <p className="pb-3 text-[13px] leading-relaxed text-ink-600">
              People can collect this post at a price you set. You keep 95%.
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.5"
                value={collect?.price ?? ''}
                onChange={(e) =>
                  setCollect({ price: e.target.value, asset: collect?.asset ?? 'USDC' })
                }
                placeholder="1.00"
                leading={<Sparkles className="size-4" />}
              />
              <select
                value={collect?.asset ?? 'USDC'}
                onChange={(e) =>
                  setCollect({
                    price: collect?.price ?? '',
                    asset: e.target.value as TokenSymbol,
                  })
                }
                className="h-11 shrink-0 panel-sm bg-white px-3 text-[14px] font-semibold text-ink-800 focus:border-brand-400 focus:outline-none"
              >
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
                <option value="MESH">MESH</option>
              </select>
            </div>
            {collect && (
              <button
                onClick={() => setCollect(null)}
                className="mt-2 text-[12.5px] font-semibold text-ink-500 hover:text-danger"
              >
                Remove collect price
              </button>
            )}
          </ToolPanel>
        )}

                {tool === 'location' && (
          <ToolPanel title="Add location" onClose={() => setTool(null)}>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where are you?"
              leading={<MapPin className="size-4" />}
            />
          </ToolPanel>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) attachFile(file)
          e.target.value = ''
        }}
      />

      {/* Tool list */}
      <div className="mt-4 divide-y divide-ink-700/12 panel">
        <ToolRow
          icon={<ImagePlus className="size-[18px] text-emerald-600" />}
          label="Add photo / video"
          active={tool === 'media'}
          onClick={() => setTool(tool === 'media' ? null : 'media')}
        />
        <ToolRow
          icon={<MapPin className="size-[18px] text-rose-600" />}
          label="Add location"
          value={location || undefined}
          active={tool === 'location'}
          onClick={() => setTool(tool === 'location' ? null : 'location')}
        />
        <ToolRow
          icon={<BarChart3 className="size-[18px] text-brand-600" />}
          label="Poll"
          value={validPoll ? `${pollOptions.filter((o) => o.trim()).length} options` : undefined}
          active={tool === 'poll'}
          onClick={() => setTool(tool === 'poll' ? null : 'poll')}
        />
        <ToolRow
          icon={<CalendarDays className="size-[18px] text-amber-600" />}
          label="Event"
          value={event.title || undefined}
          active={tool === 'event'}
          onClick={() => setTool(tool === 'event' ? null : 'event')}
        />
        <ToolRow
          icon={<Gem className="size-[18px] text-violet-600" />}
          label="NFT / Collectible"
          value={collect?.price ? `${collect.price} ${collect.asset}` : undefined}
          active={tool === 'collect'}
          onClick={() => setTool(tool === 'collect' ? null : 'collect')}
        />
      </div>

      {/* Audience */}
      <div className="mt-3 panel p-3">
        <div className="flex items-center gap-2 pb-2">
          <audienceMeta.icon className="size-[18px] text-ink-500" />
          <span className="flex-1 text-[14px] font-semibold text-ink-900">Audience</span>
          <span className="text-[13px] font-semibold text-brand-600">{audienceMeta.label}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {AUDIENCES.map((option) => (
            <button
              key={option.id}
              onClick={() => setAudience(option.id)}
              title={option.hint}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                audience === option.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-ink-700/8 text-ink-600 hover:bg-ink-700/12',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {audience === 'community' && (
          <div className="mt-2.5">
            {myCommunities.length === 0 ? (
              <p className="text-[12.5px] text-ink-500">
                Join a community first to post in one.
              </p>
            ) : (
              <select
                value={communityId ?? ''}
                onChange={(e) => setCommunityId(e.target.value || undefined)}
                className="h-10 w-full panel-sm bg-white px-3 text-[13.5px] font-medium text-ink-800 focus:border-brand-400 focus:outline-none"
              >
                <option value="">Choose a community…</option>
                {myCommunities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function ToolRow({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl',
        active ? 'bg-brand-600/10' : 'hover:bg-ink-700/[0.05]',
      )}
    >
      {icon}
      <span className="flex-1 text-[14px] font-semibold text-ink-800">{label}</span>
      {value && <span className="max-w-[120px] truncate text-[12.5px] text-brand-600">{value}</span>}
      <ChevronRight
        className={cn('size-4 text-ink-400 transition-transform', active && 'rotate-90')}
      />
    </button>
  )
}

function ToolPanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="panel-inset p-3 animate-[var(--animate-pop-in)]">
      <div className="flex items-center justify-between pb-2">
        <span className="text-[13px] font-bold text-ink-900">{title}</span>
        <button onClick={onClose} aria-label={`Close ${title}`} className="text-ink-400 hover:text-ink-700">
          <X className="size-4" />
        </button>
      </div>
      {children}
    </div>
  )
}

function SceneThumb({
  scene,
  tone,
  selected,
  onSelect,
}: {
  scene: SceneKind
  tone: number
  selected?: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      aria-label={`Use ${scene} artwork`}
      className={cn(
        'aspect-square rounded-xl bg-cover bg-center transition-all',
        selected ? 'ring-2 ring-brand-500 ring-offset-2' : 'hover:opacity-85',
      )}
      style={{ backgroundImage: sceneUrl(scene, tone) }}
    />
  )
}
