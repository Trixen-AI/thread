/**
 * Deterministic artwork.
 *
 * MESH ships no bitmap assets — every avatar, cover and piece of post media is
 * generated as an SVG from a seed, so the seeded feed looks populated and
 * consistent without shipping (or hot-linking) photography. Real uploads would
 * replace these at the data layer; nothing in the UI assumes generated art.
 */

import type { AvatarSeed, SceneKind } from '@/types'

export interface Tone {
  from: string
  via: string
  to: string
  ink: string
}

export const TONES: Tone[] = [
  { from: '#6C5CE7', via: '#8E7BFF', to: '#C6BCFF', ink: '#2A1F6B' }, // brand violet
  { from: '#1E293B', via: '#334155', to: '#64748B', ink: '#0B1220' }, // slate night
  { from: '#0EA5E9', via: '#38BDF8', to: '#A5F3FC', ink: '#083344' }, // sky
  { from: '#F43F5E', via: '#FB7185', to: '#FECDD3', ink: '#4C0519' }, // rose
  { from: '#059669', via: '#34D399', to: '#A7F3D0', ink: '#022C22' }, // emerald
  { from: '#D97706', via: '#FBBF24', to: '#FDE68A', ink: '#451A03' }, // amber
  { from: '#7C3AED', via: '#A78BFA', to: '#DDD6FE', ink: '#2E1065' }, // purple
  { from: '#0F766E', via: '#2DD4BF', to: '#99F6E4', ink: '#042F2E' }, // teal
  { from: '#BE185D', via: '#EC4899', to: '#FBCFE8', ink: '#500724' }, // pink
  { from: '#1D4ED8', via: '#60A5FA', to: '#BFDBFE', ink: '#172554' }, // blue
  { from: '#4338CA', via: '#818CF8', to: '#C7D2FE', ink: '#1E1B4B' }, // indigo
  { from: '#334155', via: '#94A3B8', to: '#E2E8F0', ink: '#0F172A' }, // graphite
]

export const tone = (i: number): Tone => TONES[Math.abs(i) % TONES.length]

/** CSS gradient for monogram avatars and small brand surfaces. */
export function avatarGradient(seed: AvatarSeed): string {
  const t = tone(seed.tone)
  return `linear-gradient(135deg, ${t.from} 0%, ${t.via} 55%, ${t.to} 100%)`
}

/* --------------------------------------------------------------------- */
/* Scenes                                                                 */
/* --------------------------------------------------------------------- */

const W = 800
const H = 500

const defs = (t: Tone, id: string) => `
<defs>
  <linearGradient id="sky${id}" x1="0" y1="0" x2="0.3" y2="1">
    <stop offset="0%" stop-color="${t.ink}"/>
    <stop offset="55%" stop-color="${t.from}"/>
    <stop offset="100%" stop-color="${t.via}"/>
  </linearGradient>
  <linearGradient id="warm${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${t.from}"/>
    <stop offset="50%" stop-color="${t.via}"/>
    <stop offset="100%" stop-color="${t.to}"/>
  </linearGradient>
  <linearGradient id="fade${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${t.ink}" stop-opacity="0.55"/>
    <stop offset="60%" stop-color="${t.ink}" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="glow${id}" cx="0.7" cy="0.25" r="0.7">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
  </radialGradient>
  <filter id="soft${id}" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="26"/>
  </filter>
</defs>`

const SCENES: Record<SceneKind, (t: Tone, id: string) => string> = {
  /**
   * Layered mountain ridges under a graded sky.
   *
   * Distant ridges are hazed toward white and near ones toward the tone's
   * darkest ink, so the depth reads on light and dark palettes alike — filling
   * every ridge from the same colour flattens the whole scene.
   */
  peaks: (t, id) => `
    <rect width="${W}" height="${H}" fill="url(#sky${id})"/>
    <circle cx="620" cy="118" r="44" fill="#fff" opacity="0.9"/>
    <circle cx="620" cy="118" r="90" fill="#fff" opacity="0.12"/>
    <rect width="${W}" height="${H}" fill="url(#glow${id})"/>
    <path d="M0 372 L118 268 L196 322 L286 232 L392 344 L470 292 L560 358 L648 300 L${W} 380 L${W} ${H} L0 ${H} Z"
      fill="#ffffff" opacity="0.20"/>
    <path d="M0 406 L96 330 L184 380 L268 306 L360 384 L452 336 L548 400 L642 348 L${W} 414 L${W} ${H} L0 ${H} Z"
      fill="${t.via}" opacity="0.75"/>
    <path d="M0 442 L112 384 L214 430 L318 372 L430 438 L536 392 L646 440 L${W} 398 L${W} ${H} L0 ${H} Z"
      fill="${t.ink}" opacity="0.62"/>
    <path d="M0 480 L140 424 L268 470 L392 416 L520 476 L648 430 L${W} 474 L${W} ${H} L0 ${H} Z"
      fill="${t.ink}" opacity="0.95"/>
    <path d="M268 306 L300 342 L268 358 L238 342 Z" fill="#ffffff" opacity="0.75"/>
    <path d="M96 330 L120 360 L96 372 L74 360 Z" fill="#ffffff" opacity="0.6"/>
    <path d="M452 336 L474 364 L452 374 L432 364 Z" fill="#ffffff" opacity="0.5"/>`,

  /** Dense skyline at dusk. */
  city: (t, id) => `
    <rect width="${W}" height="${H}" fill="url(#sky${id})"/>
    <circle cx="170" cy="118" r="200" fill="url(#glow${id})"/>
    ${[
      [40, 300, 62],
      [110, 250, 54],
      [172, 330, 48],
      [228, 210, 70],
      [306, 288, 56],
      [370, 174, 62],
      [440, 262, 74],
      [522, 316, 50],
      [580, 226, 66],
      [654, 296, 58],
      [720, 244, 68],
    ]
      .map(
        ([x, y, w], i) =>
          `<rect x="${x}" y="${y}" width="${w}" height="${H - (y as number)}" rx="4" fill="${
            t.ink
          }" opacity="${0.45 + (i % 3) * 0.18}"/>`,
      )
      .join('')}
    ${Array.from({ length: 54 })
      .map((_, i) => {
        const x = 48 + ((i * 61) % 700)
        const y = 240 + ((i * 47) % 220)
        return `<rect x="${x}" y="${y}" width="6" height="8" rx="1" fill="${t.to}" opacity="${
          0.25 + ((i * 7) % 5) * 0.14
        }"/>`
      })
      .join('')}
    <rect y="${H - 90}" width="${W}" height="90" fill="${t.ink}" opacity="0.5"/>`,

  /** Concentric orbits — used for network / protocol posts. */
  orbit: (_t, id) => `
    <rect width="${W}" height="${H}" fill="url(#warm${id})"/>
    <g stroke="#ffffff" fill="none">
      <circle cx="400" cy="250" r="60" opacity="0.9" stroke-width="1.5"/>
      <circle cx="400" cy="250" r="118" opacity="0.55" stroke-width="1.5"/>
      <circle cx="400" cy="250" r="176" opacity="0.35" stroke-width="1.5"/>
      <circle cx="400" cy="250" r="234" opacity="0.2" stroke-width="1.5"/>
    </g>
    <circle cx="400" cy="250" r="30" fill="#ffffff" opacity="0.95"/>
    ${[
      [400, 132, 9],
      [518, 250, 7],
      [283, 309, 8],
      [576, 172, 6],
      [224, 190, 6],
      [478, 402, 7],
    ]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="0.95"/>`)
      .join('')}
    <rect width="${W}" height="${H}" fill="url(#fade${id})"/>`,

  /** The MESH mark: an interconnected lattice. */
  grid: (t, id) => `
    <rect width="${W}" height="${H}" fill="url(#sky${id})"/>
    <g stroke="${t.to}" stroke-width="1" opacity="0.28">
      ${Array.from({ length: 9 })
        .map((_, r) => `<line x1="0" y1="${40 + r * 55}" x2="${W}" y2="${40 + r * 55}"/>`)
        .join('')}
      ${Array.from({ length: 13 })
        .map((_, c) => `<line x1="${30 + c * 62}" y1="0" x2="${30 + c * 62}" y2="${H}"/>`)
        .join('')}
    </g>
    ${Array.from({ length: 26 })
      .map((_, i) => {
        const x = 30 + ((i * 5) % 13) * 62
        const y = 40 + ((i * 3) % 9) * 55
        return `<circle cx="${x}" cy="${y}" r="${3 + (i % 3)}" fill="${t.to}" opacity="0.9"/>`
      })
      .join('')}
    <g opacity="0.9" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round">
      <path d="M300 320 L300 190 L400 268 L500 190 L500 320"/>
    </g>
    <rect width="${W}" height="${H}" fill="url(#glow${id})" opacity="0.5"/>`,

  /** Soft horizontal waves — calm backdrop for text-forward posts. */
  waves: (t, id) => `
    <rect width="${W}" height="${H}" fill="url(#warm${id})"/>
    ${[0, 1, 2, 3, 4]
      .map(
        (i) =>
          `<path d="M0 ${170 + i * 62} C 190 ${120 + i * 62}, 300 ${230 + i * 62}, 460 ${
            180 + i * 62
          } S 700 ${120 + i * 62}, ${W} ${186 + i * 62} L${W} ${H} L0 ${H} Z" fill="${
            t.ink
          }" opacity="${0.1 + i * 0.14}"/>`,
      )
      .join('')}
    <rect width="${W}" height="${H}" fill="url(#glow${id})" opacity="0.6"/>`,

  /** Blurred organic blobs — editorial, works well behind headlines. */
  bloom: (t, id) => `
    <rect width="${W}" height="${H}" fill="${t.ink}"/>
    <g filter="url(#soft${id})">
      <circle cx="220" cy="180" r="150" fill="${t.from}" opacity="0.95"/>
      <circle cx="520" cy="150" r="130" fill="${t.via}" opacity="0.9"/>
      <circle cx="640" cy="360" r="160" fill="${t.to}" opacity="0.75"/>
      <circle cx="300" cy="400" r="140" fill="${t.from}" opacity="0.7"/>
    </g>
    <rect width="${W}" height="${H}" fill="url(#glow${id})" opacity="0.35"/>`,

  /** Angular prism facets — for collectibles and marketplace art. */
  prism: (t, id) => `
    <rect width="${W}" height="${H}" fill="url(#sky${id})"/>
    <g opacity="0.92">
      <path d="M400 70 L610 250 L400 430 L190 250 Z" fill="${t.via}" opacity="0.85"/>
      <path d="M400 70 L610 250 L400 250 Z" fill="#ffffff" opacity="0.35"/>
      <path d="M400 430 L190 250 L400 250 Z" fill="${t.ink}" opacity="0.4"/>
      <path d="M400 70 L400 430" stroke="#ffffff" stroke-width="1.5" opacity="0.4"/>
    </g>
    <g stroke="${t.to}" stroke-width="1.2" opacity="0.4" fill="none">
      <path d="M60 120 L200 60 L340 120"/>
      <path d="M460 400 L600 460 L740 400"/>
    </g>
    <rect width="${W}" height="${H}" fill="url(#glow${id})" opacity="0.45"/>`,
}

const cache = new Map<string, string>()

/** A scene as a `url(...)`-ready data URI. Memoised — these are pure. */
export function sceneUrl(kind: SceneKind, toneIndex: number): string {
  const key = `${kind}:${toneIndex}`
  const hit = cache.get(key)
  if (hit) return hit

  const t = tone(toneIndex)
  const id = `${kind}${Math.abs(toneIndex) % TONES.length}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${defs(
    t,
    id,
  )}${SCENES[kind](t, id)}</svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`
  cache.set(key, url)
  return url
}

export const SCENE_KINDS = Object.keys(SCENES) as SceneKind[]
