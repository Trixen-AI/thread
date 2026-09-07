import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { db, now } from './db.js'

/**
 * Accounts and sessions.
 *
 * Passwords are stored as scrypt hashes with a per-user salt — never in plain
 * text, never reversible, and never returned by any endpoint. Session tokens
 * are random 256-bit values; the database keeps only their SHA-256 digest, so
 * a copy of the database does not hand over live sessions.
 */

const SCRYPT_KEYLEN = 64
const SESSION_DAYS = 30

const hashPassword = (password, salt) =>
  scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')

const hashToken = (token) => createHash('sha256').update(token).digest('hex')

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/

export function validateCredentials({ handle, name, password }) {
  const errors = {}
  const h = (handle ?? '').trim().toLowerCase()

  if (!HANDLE_RE.test(h)) {
    errors.handle = 'Use 3–20 characters: lowercase letters, numbers or underscore.'
  }
  if (!name || name.trim().length < 1 || name.trim().length > 40) {
    errors.name = 'Enter a display name of 1–40 characters.'
  }
  if (!password || password.length < 8) {
    errors.password = 'Use at least 8 characters.'
  } else if (password.length > 200) {
    errors.password = 'That password is too long.'
  }
  return { errors, ok: Object.keys(errors).length === 0, handle: h }
}

export function handleTaken(handle) {
  return !!db
    .prepare('SELECT 1 FROM users WHERE handle_lower = ?')
    .get(handle.trim().toLowerCase())
}

export function createUser({ handle, name, password }) {
  const salt = randomBytes(16).toString('hex')
  const id = randomUUID()
  const lower = handle.trim().toLowerCase()

  // Deterministic-but-varied art seed, so new profiles are not all one colour.
  const tone = Math.abs([...lower].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 12

  db.prepare(
    `INSERT INTO users
       (id, handle, handle_lower, name, bio, avatar_tone, cover_scene, cover_tone,
        reputation, password_hash, password_salt, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, '', ?, ?, ?, 0, ?, ?, ?, ?)`,
  ).run(
    id,
    lower,
    lower,
    name.trim(),
    tone,
    ['bloom', 'peaks', 'waves', 'prism', 'orbit', 'grid', 'city'][tone % 7],
    tone,
    hashPassword(password, salt),
    salt,
    now(),
    now(),
  )

  return id
}

export function verifyPassword(handle, password) {
  const row = db
    .prepare(
      'SELECT id, password_hash, password_salt FROM users WHERE handle_lower = ?',
    )
    .get((handle ?? '').trim().toLowerCase())

  // Demo personas have no password set — they cannot be signed into.
  if (!row?.password_hash || !row.password_salt) return null

  const attempt = Buffer.from(hashPassword(password, row.password_salt), 'hex')
  const stored = Buffer.from(row.password_hash, 'hex')
  if (attempt.length !== stored.length) return null
  return timingSafeEqual(attempt, stored) ? row.id : null
}

export function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(hashToken(token), userId, now(), expires)
  return token
}

export function userIdForToken(token) {
  if (!token) return null
  const row = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(hashToken(token))
  if (!row) return null
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
    return null
  }
  return row.user_id
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}

/* ---------------------------------------------------------------------- */

/**
 * Throttle sign-in attempts per handle+IP so the endpoint cannot be used to
 * guess passwords at speed. In-memory: a restart clears it, which is an
 * acceptable trade for a self-hosted instance.
 */
const attempts = new Map()
const WINDOW_MS = 15 * 60_000
const MAX_ATTEMPTS = 10

export function tooManyAttempts(key) {
  const entry = attempts.get(key)
  if (!entry) return false
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key)
    return false
  }
  return entry.count >= MAX_ATTEMPTS
}

export function recordAttempt(key, success) {
  if (success) {
    attempts.delete(key)
    return
  }
  const entry = attempts.get(key)
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { first: Date.now(), count: 1 })
  } else {
    entry.count += 1
  }
}
