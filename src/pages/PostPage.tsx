import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Send } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import {
  selectComments,
  selectCurrentUser,
  selectPost,
  selectUser,
  useApp,
} from '@/store/appStore'
import { addComment, loadComments, toggleCommentLike } from '@/store/actions'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/Feedback'
import { VerifiedBadge } from '@/components/ui/Badge'
import { PostCard } from '@/features/feed/PostCard'

export function PostPage() {
  const { id = '' } = useParams()
  const state = useApp()
  const navigate = useNavigate()
  const me = selectCurrentUser(state)
  const [draft, setDraft] = useState('')

  const post = selectPost(state, id)

  useEffect(() => {
    if (id) void loadComments(id)
  }, [id])

  if (!post) return <Navigate to="/" replace />

  const comments = selectComments(state, post.id)

  const submit = () => {
    if (!draft.trim()) return
    void addComment(post.id, draft)
    setDraft('')
  }

  return (
    <AppShell>
      <div className="space-y-3">
        <Card className="mesh-card-flush overflow-hidden p-0">
          <PageHeader title="Post" onBack={() => navigate(-1)} className="lg:rounded-t-[20px]" />
          <PostCard post={post} variant="detail" />
        </Card>

        <Card className="mesh-card-flush">
          <div className="flex items-center gap-2 hairline p-3">
            <Avatar seed={me.avatar} size="sm" name={me.name} />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
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

          {comments.length === 0 ? (
            <EmptyState
              icon={<Send className="size-6" />}
              title="No comments yet"
              description="Start the conversation."
            />
          ) : (
            <ul className="divide-y divide-ink-700/12">
              {comments.map((comment) => {
                const author = selectUser(state, comment.authorId)
                return (
                  <li key={comment.id} className="flex items-start gap-3 p-4">
                    <Avatar seed={author.avatar} size="md" name={author.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-[14px]">
                        <span className="truncate font-bold text-ink-900">{author.name}</span>
                        {author.verified && <VerifiedBadge />}
                        <span className="text-ink-400">·</span>
                        <span className="text-[13px] text-ink-500">
                          {timeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[14px] leading-snug text-ink-800">{comment.text}</p>
                      <button
                        onClick={() => toggleCommentLike(comment.id)}
                        className={`mt-1.5 text-[12.5px] font-semibold transition-colors hover:text-ink-700 ${
                          comment.likedByMe ? 'text-like' : 'text-ink-500'
                        }`}
                      >
                        {comment.likes > 0 ? `${comment.likes} likes` : 'Like'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
