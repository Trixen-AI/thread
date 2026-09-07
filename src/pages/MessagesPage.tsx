import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BellOff,
  Coins,
  ImagePlus,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  Smile,
  Users,
} from 'lucide-react'
import { cn, clockTime, compact, timeAgo } from '@/lib/utils'
import type { Conversation, MessageAttachment } from '@/types'
import {
  selectCommunity,
  selectConversationMessages,
  selectLastMessage,
  selectUser,
  useApp,
} from '@/store/appStore'
import {
  loadMessages,
  markConversationRead,
  notifyTyping,
  sendMessage,
  syncConversations,
  toggleMuteConversation,
} from '@/store/actions'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Badge, VerifiedBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/Feedback'
import { Menu, MenuItem } from '@/components/ui/Menu'
import { Scene } from '@/components/social/Scene'
import { TokenIcon } from '@/features/wallet/TokenIcon'

const EMOJI = ['👋', '🙏', '🔥', '🚀', '💜', '😂', '👀', '✅', '🎉', '🧠', '☕️', '📈']

export function MessagesPage() {
  const { id } = useParams()
  const state = useApp()
  const [query, setQuery] = useState('')

  useEffect(() => {
    void syncConversations()
  }, [])

  const conversations = [...state.conversations]
    .filter((c) => {
      if (!query.trim()) return true
      const label = conversationLabel(state, c).toLowerCase()
      return label.includes(query.toLowerCase())
    })
    .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt))

  const active = id ? state.conversations.find((c) => c.id === id) : undefined

  return (
    <>
      {!id && <MobileTopBar title="Messages" showLogo={false} />}
      <AppShell rail={null} wide>
        <Card className="mesh-card-flush flex overflow-hidden lg:h-[calc(100dvh-6.5rem)]">
          {/* Conversation list */}
          <div
            className={cn(
              'flex min-h-0 w-full flex-col lg:w-[340px] lg:shrink-0 lg:shadow-[inset_-0.5px_0_0_rgb(60_60_67/0.2)]',
              id && 'hidden lg:flex',
            )}
          >
            <div className="hairline px-4 py-3">
              <h1 className="hidden pb-2.5 text-[21px] font-bold tracking-[-0.03em] text-ink-900 lg:block">
                Messages
              </h1>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages..."
                leading={<Search className="size-4" />}
                className="h-10"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scroll-slim p-1.5">
              {conversations.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="size-6" />}
                  title="No conversations"
                  description="Search for someone or start a chat from their profile."
                />
              ) : (
                conversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === id}
                  />
                ))
              )}
            </div>
          </div>

          {/* Thread */}
          <div className={cn('min-h-0 flex-1 flex-col', id ? 'flex' : 'hidden lg:flex')}>
            {active ? (
              <Thread conversation={active} />
            ) : (
              <EmptyState
                className="my-auto"
                icon={<MessageSquare className="size-6" />}
                title="Select a conversation"
                description="Pick someone from the list to start reading."
              />
            )}
          </div>
        </Card>
      </AppShell>
    </>
  )
}

/* ------------------------------- Helpers ------------------------------- */

function conversationLabel(state: ReturnType<typeof useApp>, conversation: Conversation): string {
  if (conversation.communityId) {
    return selectCommunity(state, conversation.communityId)?.name ?? 'Community'
  }
  return selectUser(state, conversation.participantIds[0]).name
}

function ConversationRow({
  conversation,
  active,
}: {
  conversation: Conversation
  active: boolean
}) {
  const state = useApp()
  const other = selectUser(state, conversation.participantIds[0])
  const community = conversation.communityId
    ? selectCommunity(state, conversation.communityId)
    : undefined
  const last = selectLastMessage(state, conversation.id)
  const preview = last
    ? last.text || attachmentPreview(last.attachment)
    : 'No messages yet'

  return (
    <Link
      to={`/messages/${conversation.id}`}
      onClick={() => markConversationRead(conversation.id)}
      className={cn(
        'flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors',
        active ? 'bg-brand-600/10' : 'hover:bg-ink-700/[0.05]',
      )}
    >
      <div className="relative shrink-0">
        <Avatar
          seed={community?.avatar ?? other.avatar}
          size="lg"
          square={!!community}
          name={community?.name ?? other.name}
        />
        {conversation.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-brand-600 ring-2 ring-white" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'truncate text-[14px]',
              conversation.unread > 0 ? 'font-bold text-ink-900' : 'font-semibold text-ink-800',
            )}
          >
            {community?.name ?? other.name}
          </span>
          {(community?.verified ?? other.verified) && <VerifiedBadge className="size-[13px]" />}
          {conversation.muted && <BellOff className="size-3 shrink-0 text-ink-400" />}
        </div>
        <p
          className={cn(
            'truncate text-[12.5px]',
            conversation.unread > 0 ? 'font-medium text-ink-700' : 'text-ink-500',
          )}
        >
          {last?.senderId === state.me?.id && 'You: '}
          {preview}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[11.5px] text-ink-400">{timeAgo(conversation.lastMessageAt)}</span>
        {conversation.unread > 0 && (
          <span className="min-w-[18px] rounded-full bg-brand-600 px-1.5 text-center text-[10.5px] font-bold leading-[18px] text-white">
            {conversation.unread}
          </span>
        )}
      </div>
    </Link>
  )
}

const attachmentPreview = (attachment?: MessageAttachment) => {
  if (!attachment) return ''
  switch (attachment.kind) {
    case 'image':
      return '📷 Photo'
    case 'file':
      return `📎 ${attachment.name}`
    case 'payment':
      return `💰 Sent ${attachment.amount} ${attachment.asset}`
    case 'invite':
      return '👥 Community invite'
  }
}

/* -------------------------------- Thread -------------------------------- */

function Thread({ conversation }: { conversation: Conversation }) {
  const state = useApp()
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const messages = selectConversationMessages(state, conversation.id)
  const other = selectUser(state, conversation.participantIds[0])
  const community = conversation.communityId
    ? selectCommunity(state, conversation.communityId)
    : undefined

  useEffect(() => {
    void loadMessages(conversation.id)
  }, [conversation.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, conversation.id])

  const submit = (attachment?: MessageAttachment) => {
    if (!draft.trim() && !attachment) return
    void sendMessage(conversation.id, draft, attachment)
    setDraft('')
    setEmojiOpen(false)
  }

  return (
    <>
      <header className="flex items-center gap-3 hairline px-3 py-2.5">
        <button
          onClick={() => navigate('/messages')}
          aria-label="Back to messages"
          className="-ml-1 flex size-9 items-center justify-center rounded-full text-ink-600 hover:bg-ink-700/8 lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </button>

        <Link
          to={community ? `/c/${community.slug}` : `/u/${other.handle}`}
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          <Avatar
            seed={community?.avatar ?? other.avatar}
            size="md"
            square={!!community}
            name={community?.name ?? other.name}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-[14.5px] font-bold text-ink-900">
              <span className="truncate">{community?.name ?? other.name}</span>
              {(community?.verified ?? other.verified) && <VerifiedBadge />}
            </span>
            <span className="block truncate text-[12px] text-ink-500">
              {community ? `${compact(community.members)} members` : `@${other.handle}`}
            </span>
          </span>
        </Link>

        <Menu
          trigger={({ toggle }) => (
            <IconButton label="Conversation options" size="sm" onClick={toggle}>
              <Paperclip className="size-4" />
            </IconButton>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<BellOff className="size-4" />}
                onClick={() => {
                  close()
                  toggleMuteConversation(conversation.id)
                }}
              >
                {conversation.muted ? 'Unmute' : 'Mute notifications'}
              </MenuItem>
              <MenuItem
                icon={<Users className="size-4" />}
                onClick={() => {
                  close()
                  navigate(community ? `/c/${community.slug}` : `/u/${other.handle}`)
                }}
              >
                View profile
              </MenuItem>
            </>
          )}
        </Menu>
      </header>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto scroll-slim px-3 py-4">
        {messages.map((message, i) => {
          const mine = message.senderId === state.me?.id
          const sender = selectUser(state, message.senderId)
          const showAvatar = !mine && messages[i + 1]?.senderId !== message.senderId

          return (
            <div
              key={message.id}
              className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}
            >
              {!mine && (
                <span className="w-7 shrink-0">
                  {showAvatar && <Avatar seed={sender.avatar} size="xs" name={sender.name} />}
                </span>
              )}

              <div className={cn('max-w-[78%] space-y-1', mine && 'items-end')}>
                {message.attachment && (
                  <AttachmentBubble attachment={message.attachment} mine={mine} />
                )}
                {message.text && (
                  <div
                    className={cn(
                      'w-fit rounded-[18px] px-3.5 py-2 text-[14px] leading-snug',
                      mine
                        ? 'ml-auto rounded-br-md bg-brand-600 text-white'
                        : 'rounded-bl-[6px] bg-ink-700/8 text-ink-800',
                    )}
                  >
                    {message.text}
                  </div>
                )}
                <p
                  className={cn(
                    'px-1 text-[11px] text-ink-400',
                    mine && 'text-right',
                  )}
                >
                  {clockTime(message.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {emojiOpen && (
        <div className="flex flex-wrap gap-1 hairline-t px-3 py-2 animate-[var(--animate-pop-in)]">
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setDraft((d) => d + emoji)}
              className="flex size-9 items-center justify-center rounded-lg text-[18px] hover:bg-ink-700/8"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <footer className="safe-bottom flex items-end gap-1.5 hairline-t px-3 py-2.5">
        <IconButton label="Attach image" size="sm" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="size-[19px]" />
        </IconButton>
        <IconButton
          label="Send tokens"
          size="sm"
          onClick={() =>
            submit({ kind: 'payment', amount: 5, asset: 'USDC', note: 'Sent from chat', demo: true })
          }
        >
          <Coins className="size-[19px]" />
        </IconButton>
        <IconButton
          label="Emoji"
          size="sm"
          active={emojiOpen}
          onClick={() => setEmojiOpen((v) => !v)}
        >
          <Smile className="size-[19px]" />
        </IconButton>

        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            notifyTyping(conversation.id)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder="Write a message..."
          aria-label="Write a message"
          className="field-capsule max-h-28 min-h-[40px] flex-1 resize-none rounded-[20px] px-3.5 py-2.5 text-[15px] tracking-[-0.01em] placeholder:text-ink-400"
        />

        <button
          onClick={() => submit()}
          disabled={!draft.trim()}
          aria-label="Send message"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-transform active:scale-90 disabled:opacity-40"
        >
          <Send className="size-[18px]" />
        </button>
      </footer>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) {
            submit({ kind: 'image', scene: 'bloom', tone: 6 })
          }
          e.target.value = ''
        }}
      />
    </>
  )
}

function AttachmentBubble({
  attachment,
  mine,
}: {
  attachment: MessageAttachment
  mine: boolean
}) {
  const state = useApp()

  if (attachment.kind === 'image') {
    return (
      <Scene
        kind={attachment.scene}
        tone={attachment.tone}
        className={cn('h-40 w-56', mine && 'ml-auto')}
      />
    )
  }

  if (attachment.kind === 'file') {
    return (
      <div
        className={cn(
          'flex w-fit items-center gap-2.5 panel bg-white px-3 py-2.5',
          mine && 'ml-auto',
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-ink-700/8 text-ink-500">
          <Paperclip className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block max-w-[180px] truncate text-[13px] font-semibold text-ink-900">
            {attachment.name}
          </span>
          <span className="block text-[11.5px] text-ink-500">{attachment.size}</span>
        </span>
      </div>
    )
  }

  if (attachment.kind === 'payment') {
    return (
      <div
        className={cn(
          'w-fit rounded-2xl border border-brand-200 bg-brand-50 px-3.5 py-3',
          mine && 'ml-auto',
        )}
      >
        <div className="flex items-center gap-2.5">
          <TokenIcon symbol={attachment.asset} size="md" />
          <div>
            <p className="text-[16px] font-bold tracking-[-0.02em] text-ink-900">
              {attachment.amount} {attachment.asset}
            </p>
            {attachment.note && (
              <p className="text-[12px] text-ink-600">{attachment.note}</p>
            )}
          </div>
        </div>
        <Badge tone="warn" className="mt-2">
          Demo transfer
        </Badge>
      </div>
    )
  }

  const community = selectCommunity(state, attachment.communityId)
  if (!community) return null

  return (
    <Link
      to={`/c/${community.slug}`}
      className={cn(
        'flex w-fit items-center gap-2.5 panel bg-white px-3 py-2.5 hover:bg-ink-700/[0.05]',
        mine && 'ml-auto',
      )}
    >
      <Avatar seed={community.avatar} size="md" square name={community.name} />
      <span className="min-w-0">
        <span className="block max-w-[180px] truncate text-[13px] font-bold text-ink-900">
          {community.name}
        </span>
        <span className="block text-[11.5px] text-ink-500">
          {compact(community.members)} members · Invitation
        </span>
      </span>
    </Link>
  )
}
