import type { Message, Notification, Post } from '@/types'
import { API_ORIGIN, tokenStore } from './client'

/**
 * The live connection.
 *
 * Carries new messages, notifications, posts, presence and typing indicators.
 * It reconnects on its own with backoff, because a social app that silently
 * stops updating after a laptop wakes up is worse than one that never did.
 */

export type RealtimeEvent =
  | { type: 'ready'; online: string[] }
  | { type: 'presence'; online: string[] }
  | { type: 'message'; message: Message }
  | { type: 'notification'; notification: Notification }
  | { type: 'post'; post: Post }
  | { type: 'typing'; conversationId: string; userId: string }

type Listener = (event: RealtimeEvent) => void

let socket: WebSocket | null = null
let listener: Listener | null = null
let retries = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let closedByUs = false

const url = () => {
  const token = tokenStore.get()
  const query = `?token=${encodeURIComponent(token ?? '')}`

  // The socket goes straight to the API, never through the page's host. A
  // static host in front of a separate API can proxy HTTP but not a WebSocket,
  // so when API_ORIGIN is set the socket has to be told the real address.
  if (API_ORIGIN) return `${API_ORIGIN.replace(/^http/, 'ws')}/ws${query}`

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${location.host}/ws${query}`
}

function scheduleReconnect() {
  if (closedByUs || reconnectTimer) return
  // 1s, 2s, 4s … capped at 15s.
  const delay = Math.min(1000 * 2 ** retries, 15_000)
  retries += 1
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect(listener!)
  }, delay)
}

export function connect(onEvent: Listener) {
  if (!tokenStore.get()) return
  listener = onEvent
  closedByUs = false

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }

  socket = new WebSocket(url())

  socket.onopen = () => {
    retries = 0
  }

  socket.onmessage = (event) => {
    try {
      listener?.(JSON.parse(event.data) as RealtimeEvent)
    } catch {
      /* ignore malformed frames */
    }
  }

  socket.onclose = (event) => {
    socket = null
    // 4001 is the server refusing the token — reconnecting would loop forever.
    if (event.code !== 4001) scheduleReconnect()
  }

  socket.onerror = () => socket?.close()
}

export function disconnect() {
  closedByUs = true
  retries = 0
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  socket?.close()
  socket = null
  listener = null
}

export function sendTyping(conversationId: string) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'typing', conversationId }))
  }
}

export const isConnected = () => socket?.readyState === WebSocket.OPEN
