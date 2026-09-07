import type { Toast } from '@/types'
import { uid } from '@/lib/utils'
import { ApiError } from '@/services/api/client'
import { appStore } from './appStore'

/**
 * Transient messages.
 *
 * Its own module so both the social and wallet action layers can report without
 * importing each other.
 */

export function toast(t: Omit<Toast, 'id'>) {
  const item: Toast = { ...t, id: uid('toast') }
  appStore.set((s) => ({ ...s, toasts: [...s.toasts, item] }))
  setTimeout(() => dismissToast(item.id), 4200)
  return item.id
}

export function dismissToast(id: string) {
  appStore.set((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }))
}

/** Surfaces a failure instead of swallowing it. Returns the message shown. */
export function reportError(error: unknown, fallback = 'Something went wrong') {
  const message = error instanceof ApiError ? error.message : fallback
  toast({ title: message, tone: 'error', icon: 'alert' })
  return message
}

/** Wallets reject with code 4001 when someone dismisses the prompt. */
export const isUserRejection = (error: unknown) =>
  error instanceof Error && /user rejected|4001|denied|rejected the request/i.test(error.message)
