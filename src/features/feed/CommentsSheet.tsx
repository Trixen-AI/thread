import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Send } from 'lucide-react'
import { cn, compact, timeAgo } from '@/lib/utils'
import type { Post } from '@/types'
import { selectComments, selectCurrentUser, selectUser, useApp } from '@/store/appStore'
import { addComment, loadComments, toggleCommentLike } from '@/store/actions'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/Feedback'
import { VerifiedBadge } from '@/components/ui/Badge'

export function CommentsSheet({
  post,
  open,
  onClose,
}: {
  post: Post
  open: boolean
  onClose: () => void
}) {
  const state = useApp()
  const me = selectCurrentUser(state)
  const comments = selectComments(state, post.id)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (open) void loadComments(post.id)
  }, [open, post.id])

  const submit = () => {
    if (!draft.trim()) return
    void addComment(post.id, draft)
    setDraft('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Comments"
      description={`${compact(post.comments)} on this post`}
      size="lg"
      footer={
        <div className="flex items-center gap-2">
          <Avatar seed={me.avatar} size="sm" name={me.name} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()}
            placeholder="Write a comment..."
            aria-label="Write a comment"
            className="field-capsule h-10 flex-1 px-4 text-[15px] tracking-[-0.01em] placeholder:text-ink-400"
          />
          <button
            onClick={submit}
            disabled={!draft.trim()}
            aria-label="Post comment"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-transform active:scale-90 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      }
    >
      {comments.length === 0 ? (
        <EmptyState
          icon={<Send className="size-6" />}
          title="No comments yet"
          description="Be the first to reply to this post."
        />
      ) : (
        <ul className="space-y-1 py-1">
          {comments.map((comment) => {
            const author = selectUser(state, comment.authorId)
            return (
              <li key={comment.id} className="flex items-start gap-2.5 py-2">
                <Link to={`/u/${author.handle}`} className="shrink-0">
                  <Avatar seed={author.avatar} size="sm" name={author.name} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="rounded-[18px] rounded-tl-[6px] bg-ink-700/8 px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/u/${author.handle}`}
                        className="truncate text-[13px] font-bold text-ink-900 hover:underline"
                      >
                        {author.name}
                      </Link>
                      {author.verified && <VerifiedBadge className="size-[13px]" />}
                    </div>
                    <p className="mt-0.5 text-[13.5px] leading-snug text-ink-800">
                      {comment.text}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-3 px-1 text-[12px] text-ink-500">
                    <span>{timeAgo(comment.createdAt)}</span>
                    <button
                      onClick={() => toggleCommentLike(comment.id)}
                      className={cn(
                        'flex items-center gap-1 font-semibold transition-colors hover:text-ink-700',
                        comment.likedByMe && 'text-like',
                      )}
                    >
                      <Heart
                        className="size-3.5"
                        fill={comment.likedByMe ? 'currentColor' : 'none'}
                        strokeWidth={comment.likedByMe ? 0 : 2}
                      />
                      {comment.likes > 0 ? compact(comment.likes) : 'Like'}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
