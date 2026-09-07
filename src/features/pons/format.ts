import { formatUnits, parseUnits } from 'viem'

/**
 * Numbers on the launchpad.
 *
 * Everything the chain returns is an integer in the asset's own decimals. These
 * turn one into something a person can read without ever rounding the value
 * that goes back to the chain — formatting is for display, `bigint` is for
 * transactions, and the two never mix.
 */

/** "1,234.5678", or significant digits for a value below one. */
export function fmtUnits(value: bigint, decimals: number, maxFractionDigits = 4): string {
  const n = Number(formatUnits(value, decimals))
  if (n === 0) return '0'
  if (Math.abs(n) < 1) return n.toLocaleString('en-US', { maximumSignificantDigits: 4 })
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits })
}

/** "285.7M", "1B" — for supplies, where the digits after the unit are noise. */
export function fmtCompactUnits(value: bigint, decimals: number): string {
  const n = Number(formatUnits(value, decimals))
  const units: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ]
  for (const [size, suffix] of units) {
    if (n >= size) {
      const v = n / size
      return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')}${suffix}`
    }
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** A price in the quote asset — small numbers keep their significant digits. */
export function fmtPrice(price: number, symbol: string): string {
  if (!Number.isFinite(price) || price === 0) return `0 ${symbol}`
  return `${price.toLocaleString('en-US', { maximumSignificantDigits: 4 })} ${symbol}`
}

/** Basis points to a percentage: 100 → "1%", 250 → "2.5%". */
export const fmtBps = (bps: number | bigint) => {
  const pct = Number(bps) / 100
  return `${pct.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
}

/** Fraction 0..1 to a percentage with one decimal. */
export const fmtPct = (fraction: number) =>
  `${(fraction * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`

/**
 * User input to an integer amount, or null when it is not a number the asset
 * can represent. Trailing dots and empty strings are "nothing yet", not errors.
 */
export function parseAmount(input: string, decimals: number): bigint | null {
  const trimmed = input.trim().replace(/,/g, '')
  if (!trimmed || trimmed === '.') return null
  if (!/^\d*\.?\d*$/.test(trimmed)) return null
  try {
    const value = parseUnits(trimmed, decimals)
    return value > 0n ? value : null
  } catch {
    return null
  }
}

/** An ipfs:// URI as something an <img> can load. Anything else passes through. */
export function imageUrl(uri: string): string | null {
  if (!uri) return null
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice('ipfs://'.length)}`
  if (/^https?:\/\//.test(uri)) return uri
  return null
}

/** "2m ago", "3h ago" for a millisecond timestamp, or a fallback. */
export function ago(ms: number | null, fallback = '—'): string {
  if (!ms) return fallback
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return `${Math.max(1, s)}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
