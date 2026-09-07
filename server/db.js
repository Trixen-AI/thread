import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Persistence.
 *
 * SQLite via Node's built-in `node:sqlite` — a real relational store with no
 * native module to compile. The file lives in `server/data/` and is the single
 * source of truth for accounts, posts, follows and messages.
 */

const here = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.MESH_DB ?? resolve(here, 'data', 'mesh.db')

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    handle        TEXT NOT NULL UNIQUE,
    handle_lower  TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    bio           TEXT NOT NULL DEFAULT '',
    location      TEXT,
    website       TEXT,
    avatar_tone   INTEGER NOT NULL DEFAULT 0,
    cover_scene   TEXT NOT NULL DEFAULT 'bloom',
    cover_tone    INTEGER NOT NULL DEFAULT 0,
    verified      INTEGER NOT NULL DEFAULT 0,
    -- Seeded personas that populate a new instance. Surfaced in the UI so a
    -- fictional account is never mistaken for a person who signed up.
    is_demo       INTEGER NOT NULL DEFAULT 0,
    reputation    INTEGER NOT NULL DEFAULT 0,
    password_hash TEXT,
    password_salt TEXT,
    created_at    TEXT NOT NULL,
    last_seen_at  TEXT,
    -- Written only after a signature over a server-issued nonce verifies.
    wallet_address  TEXT,
    wallet_chain_id INTEGER,
    wallet_linked_at TEXT
  );

  /* One-shot challenges for wallet linking. Consumed on use, expire fast. */
  CREATE TABLE IF NOT EXISTS wallet_nonces (
    nonce      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS posts (
    id           TEXT PRIMARY KEY,
    author_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text         TEXT NOT NULL DEFAULT '',
    media_json   TEXT,
    poll_json    TEXT,
    event_json   TEXT,
    collect_json TEXT,
    audience     TEXT NOT NULL DEFAULT 'everyone',
    location     TEXT,
    community_id TEXT,
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_posts_author  ON posts(author_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

  /*
   * One table for every per-user reaction to a post. The kind column is one of
   * like, repost, bookmark or collect. A single shape keeps the queries and the
   * API surface uniform instead of four near-identical tables.
   */
  CREATE TABLE IF NOT EXISTS post_reactions (
    post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id, kind)
  );
  CREATE INDEX IF NOT EXISTS idx_reactions_user ON post_reactions(user_id, kind);

  /*
   * The social record of a tip. Value movement itself is settled by the wallet
   * layer, which is the local demo provider unless a real one is registered —
   * so this row records that a tip happened, never that money moved onchain.
   */
  CREATE TABLE IF NOT EXISTS tips (
    id          TEXT PRIMARY KEY,
    post_id     TEXT REFERENCES posts(id) ON DELETE CASCADE,
    from_user   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      REAL NOT NULL,
    asset       TEXT NOT NULL,
    settlement  TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tips_post ON tips(post_id);

  CREATE TABLE IF NOT EXISTS comments (
    id         TEXT PRIMARY KEY,
    post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

  CREATE TABLE IF NOT EXISTS comment_likes (
    comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (comment_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (follower_id, followee_id)
  );
  CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);

  CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY,
    -- Sorted "a|b" user-id pair. Unique, so a DM can never be created twice.
    pair_key   TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    TEXT,
    PRIMARY KEY (conversation_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members(user_id);

  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text            TEXT NOT NULL DEFAULT '',
    attachment_json TEXT,
    created_at      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS notifications (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    actor_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
    post_id    TEXT,
    text       TEXT,
    read       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
`)

/*
 * Additive migrations.
 *
 * The schema above is CREATE IF NOT EXISTS, so a column added later has to be
 * applied here. Each step checks before it alters, so a fresh database and one
 * that has been running since before the column existed end up identical.
 */
const columnsOf = (table) =>
  db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name)

// A pons v2 launch attached to a post — the token's thread on MESH.
if (!columnsOf('posts').includes('token_json')) {
  db.exec('ALTER TABLE posts ADD COLUMN token_json TEXT')
}

/** Deterministic pair key so a DM between two people resolves to one row. */
export const pairKey = (a, b) => [a, b].sort().join('|')

export const now = () => new Date().toISOString()
