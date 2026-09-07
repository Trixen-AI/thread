import type {
  Comment,
  Conversation,
  Message,
  MessageAttachment,
  Notification,
  Post,
  PostDraft,
  User,
} from '@/types'

/**
 * HTTP client for the MESH API.
 *
 * Everything the social layer needs goes through here. The session token lives
 * in localStorage and is attached as a bearer header; nothing else about the
 * account is cached client-side.
 */

const TOKEN_KEY = 'mesh.token.v1'

/**
 * Where the MESH server lives.
 *
 * Empty by default, which means same origin — the dev server proxies `/api` and
 * `/ws` to the API, and a single-host deployment needs nothing else. Set
 * `VITE_API_URL` when the front end is hosted apart from the server, as it is
 * on a static host: the API keeps a database, a WebSocket and long-lived
 * connections, so it runs somewhere that can hold those, and the browser is
 * told where.
 *
 * No trailing slash, so paths concatenate cleanly.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage unavailable — the session lasts until reload */
    }
  },
}

export class ApiError extends Error {
  status: number
  /** Per-field messages, so forms can show the problem next to the input. */
  fields?: Record<string, string>

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = tokenStore.get()
  let response: Response

  try {
    response = await fetch(`${API_ORIGIN}/api${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    // `fetch` rejects the same way for an unreachable host and for a response
    // the browser refused on CORS grounds — it deliberately will not say which.
    // Naming both beats blaming the server for what is usually a origin that
    // was never added to the allowlist.
    throw new ApiError(
      0,
      API_ORIGIN
        ? `Cannot reach the MESH server at ${API_ORIGIN}. It may be starting up, or this site's address may not be in the server's allowed origins.`
        : 'Cannot reach the MESH server. Is it running?',
    )
  }

  if (response.status === 204) return undefined as T

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error ?? `Request failed (${response.status})`,
      payload.fields,
    )
  }
  return payload as T
}

/* --------------------------------- Types --------------------------------- */

export interface AuthResult {
  token: string
  user: User
}

export type ReactionKind = 'like' | 'repost' | 'bookmark' | 'collect'

/* ---------------------------------- API ---------------------------------- */

export const api = {
  /* Auth */
  register: (body: { handle: string; name: string; password: string }) =>
    request<AuthResult>('/auth/register', { method: 'POST', body }),

  login: (body: { handle: string; password: string }) =>
    request<AuthResult>('/auth/login', { method: 'POST', body }),

  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  handleAvailable: (handle: string) =>
    request<{ available: boolean; reason?: string }>(
      `/auth/handle-available?handle=${encodeURIComponent(handle)}`,
    ),

  /* Session */
  me: () => request<{ user: User; following: string[] }>('/me'),

  updateProfile: (patch: Partial<Pick<User, 'name' | 'bio' | 'location' | 'website'>>) =>
    request<{ user: User }>('/me', { method: 'PATCH', body: patch }),

  /* Wallet linking */

  /** Asks for a single-use challenge to sign. */
  walletNonce: () =>
    request<{ nonce: string; message: string }>('/wallet/nonce', { method: 'POST' }),

  /** Submits the signature. The server verifies it before storing anything. */
  linkWallet: (body: {
    address: string
    chainId: number | null
    nonce: string
    message: string
    signature: string
  }) => request<{ user: User }>('/wallet/link', { method: 'POST', body }),

  unlinkWallet: () => request<{ user: User }>('/wallet/link', { method: 'DELETE' }),

  /* People */
  users: (q = '') => request<{ users: User[] }>(`/users?q=${encodeURIComponent(q)}`),

  profile: (handle: string) =>
    request<{ user: User; posts: Post[] }>(`/users/${encodeURIComponent(handle)}`),

  setFollow: (userId: string, follow: boolean) =>
    request<{ user: User }>(`/users/${userId}/follow`, { method: 'POST', body: { follow } }),

  /**
   * Pins an image to IPFS and returns its `ipfs://` URI.
   *
   * The file is the request body rather than a multipart form: there is one
   * file and nothing else to send. The server holds the Pinata credential and
   * this never sees it.
   */
  uploadImage: async (file: File): Promise<{ cid: string; uri: string }> => {
    const token = tokenStore.get()
    let response: Response
    try {
      response = await fetch(`${API_ORIGIN}/api/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: file,
      })
    } catch {
      throw new ApiError(0, 'Cannot reach the MESH server to upload that image.')
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new ApiError(response.status, payload.error ?? 'The upload failed.')
    return payload as { cid: string; uri: string }
  },

  /* Posts */
  posts: (scope: 'for-you' | 'following' = 'for-you') =>
    request<{ posts: Post[] }>(`/posts?scope=${scope}`),

  post: (id: string) => request<{ post: Post; comments: Comment[] }>(`/posts/${id}`),

  createPost: (draft: PostDraft) =>
    request<{ post: Post }>('/posts', { method: 'POST', body: draft }),

  deletePost: (id: string) => request<{ ok: true }>(`/posts/${id}`, { method: 'DELETE' }),

  react: (id: string, kind: ReactionKind, on: boolean) =>
    request<{ post: Post }>(`/posts/${id}/react`, { method: 'POST', body: { kind, on } }),

  comments: (postId: string) => request<{ comments: Comment[] }>(`/posts/${postId}/comments`),

  addComment: (postId: string, text: string) =>
    request<{ comment: Comment; post: Post }>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: { text },
    }),

  likeComment: (commentId: string, liked: boolean) =>
    request<{ ok: true }>(`/comments/${commentId}/like`, { method: 'POST', body: { liked } }),

  saved: () => request<{ bookmarks: Post[]; collected: Post[] }>('/saved'),

  /** Records the social side of a tip. Settlement comes from the wallet layer. */
  recordTip: (body: {
    toUserId: string
    postId?: string
    amount: number
    asset: string
    settlement: 'demo' | 'onchain'
  }) => request<{ post: Post | null }>('/tips', { method: 'POST', body }),

  /* Messaging */
  conversations: () => request<{ conversations: Conversation[] }>('/conversations'),

  openConversation: (userId: string) =>
    request<{ conversationId: string; conversations: Conversation[] }>('/conversations', {
      method: 'POST',
      body: { userId },
    }),

  messages: (conversationId: string) =>
    request<{ messages: Message[] }>(`/conversations/${conversationId}/messages`),

  sendMessage: (conversationId: string, text: string, attachment?: MessageAttachment) =>
    request<{ message: Message }>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { text, attachment },
    }),

  markConversationRead: (conversationId: string) =>
    request<{ ok: true }>(`/conversations/${conversationId}/read`, { method: 'POST' }),

  /* Notifications */
  notifications: () => request<{ notifications: Notification[] }>('/notifications'),

  markNotificationsRead: (id?: string) =>
    request<{ ok: true }>('/notifications/read', { method: 'POST', body: { id } }),
}
