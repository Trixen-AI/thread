/** Tiny class-name joiner. Falsy values drop out. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** 1200 → "1.2K", 48200 → "48.2K", 1_240_000 → "1.2M" */
export function compact(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const v = n / 1000
    return `${v >= 100 ? Math.round(v) : trim(v.toFixed(1))}K`
  }
  const v = n / 1_000_000
  return `${v >= 100 ? Math.round(v) : trim(v.toFixed(1))}M`
}

const trim = (s: string) => (s.endsWith('.0') ? s.slice(0, -2) : s)

/** Full count with thousands separators — used where precision matters. */
export const full = (n: number) => n.toLocaleString('en-US')

export function usd(n: number, opts: { cents?: boolean } = {}): string {
  const cents = opts.cents ?? true
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })
}

/** Token amounts: enough precision for ETH, not silly for MESH. */
export function tokenAmount(n: number, symbol: string): string {
  const decimals = symbol === 'ETH' ? 4 : n % 1 === 0 ? 0 : 2
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

/** "2h", "4d", "Mar 12" — feed-style relative time. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  const s = Math.max(0, Math.floor((now - then) / 1000))
  if (s < 60) return `${Math.max(1, s)}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  const date = new Date(iso)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/**
 * Wallet addresses are shown truncated by default. The full value is only
 * revealed on explicit request — an address is an identifier, not decoration.
 */
export function shortAddress(address: string, lead = 4, tail = 3): string {
  if (!address) return ''
  return `${address.slice(0, 2 + lead)}…${address.slice(-tail)}`
}

export const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** ISO timestamp `minutes` in the past — used by the seed data. */
export const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString()

export const daysAgo = (days: number) => minutesAgo(days * 60 * 24)
