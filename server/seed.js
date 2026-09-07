import { randomUUID } from 'node:crypto'
import { db, now } from './db.js'

/**
 * Seeds fictional personas so a fresh instance is not an empty room.
 *
 * Every account here is invented and is flagged `is_demo`, which the client
 * surfaces as a visible "Demo" badge — a seeded persona must never be mistaken
 * for a person who signed up. They hold no password, so nobody can sign in as
 * one, and they never reply to messages.
 */

const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString()

const PEOPLE = [
  {
    handle: 'mayaokonkwo',
    name: 'Maya Okonkwo',
    bio: 'Protocol engineer. Writing about the parts of decentralisation that actually matter.',
    location: 'Lagos → Berlin',
    website: 'maya.build',
    tone: 1,
    scene: 'peaks',
    verified: 1,
    reputation: 1560,
  },
  {
    handle: 'nadiarahman',
    name: 'Nadia Rahman',
    bio: 'Artist. Collector. I make things that live on the internet.',
    location: 'Kuala Lumpur',
    tone: 8,
    scene: 'bloom',
    verified: 1,
    reputation: 1204,
  },
  {
    handle: 'dorianvale',
    name: 'Dorian Vale',
    bio: 'Early-stage investor. Mostly wrong, occasionally early.',
    location: 'London',
    tone: 2,
    scene: 'city',
    verified: 1,
    reputation: 1890,
  },
  {
    handle: 'priyanair',
    name: 'Priya Nair',
    bio: 'Community lead at Ridgeline. Ask me about anything except my inbox.',
    location: 'Bengaluru',
    tone: 4,
    scene: 'grid',
    verified: 1,
    reputation: 1340,
  },
  {
    handle: 'kenjiaoki',
    name: 'Kenji Aoki',
    bio: 'Product designer. Interfaces should disappear.',
    location: 'Tokyo',
    website: 'kenji.design',
    tone: 11,
    scene: 'prism',
    reputation: 720,
  },
  {
    handle: 'riosantoso',
    name: 'Rio Santoso',
    bio: 'Shipping small things every week from Jakarta.',
    location: 'Jakarta, Indonesia',
    tone: 5,
    scene: 'waves',
    reputation: 486,
  },
  {
    handle: 'sashalind',
    name: 'Sasha Lindqvist',
    bio: 'Data, charts, and being annoying about methodology.',
    location: 'Stockholm',
    tone: 9,
    scene: 'grid',
    verified: 1,
    reputation: 1420,
  },
  {
    handle: 'amaradiallo',
    name: 'Amara Diallo',
    bio: 'Writing a newsletter about the creator economy. 40k readers, zero ads.',
    location: 'Dakar',
    tone: 3,
    scene: 'bloom',
    verified: 1,
    reputation: 1105,
  },
  {
    handle: 'lukasbrandt',
    name: 'Lukas Brandt',
    bio: 'Security research. I read your contracts so you do not have to.',
    location: 'Zürich',
    tone: 7,
    scene: 'orbit',
    reputation: 1640,
  },
  {
    handle: 'mesh',
    name: 'MESH',
    bio: 'Your Identity. Your Network. Your Value.',
    website: 'mesh.social',
    tone: 0,
    scene: 'grid',
    verified: 1,
    reputation: 2400,
  },
]

const POSTS = [
  {
    handle: 'mayaokonkwo',
    minutes: 118,
    text: 'The next wave of the internet will be owned by the people.\nNot platforms. Not corporations.\n\nOnchain social is inevitable.',
    media: { kind: 'image', scene: 'peaks', tone: 1, overline: 'A MORE', caption: 'OPEN INTERNET' },
  },
  {
    handle: 'nadiarahman',
    minutes: 240,
    text: 'Communities are the new economies.\n\nThe most valuable thing in crypto isn’t a token. It’s people who keep showing up.',
    media: { kind: 'image', scene: 'city', tone: 8 },
  },
  {
    handle: 'kenjiaoki',
    minutes: 34,
    text: 'Spent the morning removing features instead of adding them.\n\nThe screen got faster, the code got shorter, and nobody will notice. That is the job.',
  },
  {
    handle: 'sashalind',
    minutes: 72,
    text: 'Looked at six months of onchain social data. The pattern that surprised me:\n\nAccounts with a linked wallet post 40% less — but their posts get collected 9x more often.\n\nOwnership changes what people bother to publish.',
  },
  {
    handle: 'dorianvale',
    minutes: 160,
    text: 'Unpopular opinion: most people do not want to "own" their social graph.\n\nThey want their friends to be there, their photos to load fast, and nothing to be deleted.\n\nOwnership is how you deliver that — not the pitch.',
  },
  {
    handle: 'priyanair',
    minutes: 52,
    text: 'Build call #94 is up. Three demos, one of them from someone who started coding in March.\n\nCome break things with us on Thursday.',
  },
  {
    handle: 'lukasbrandt',
    minutes: 88,
    text: 'Reminder for everyone shipping this week:\n\nA "verify ownership" button that signs a message is not the same as a permission system. If your backend trusts the client, the signature is decoration.',
  },
  {
    handle: 'riosantoso',
    minutes: 26,
    text: 'Week 31 of shipping something small every Friday.\n\nThis week: an import tool that took two hours and saved a friend two days. Best ratio I have had all year.',
  },
  {
    handle: 'amaradiallo',
    minutes: 300,
    text: 'How I built my first dApp — the whole thing, including the parts where I gave up twice.\n\nIt is long. It is honest. It is free to read.',
  },
  {
    handle: 'mesh',
    minutes: 190,
    text: 'MESH is open.\n\nCreate an account, find people, follow them, and message anyone directly. Your posts and your conversations are yours.',
    media: { kind: 'image', scene: 'grid', tone: 0, overline: 'Now open', caption: 'Join the network' },
  },
  {
    handle: 'nadiarahman',
    minutes: 520,
    text: 'New piece. Twelve hours of work, one hour of second-guessing, and a colour I still am not sure about.',
    media: { kind: 'image', scene: 'bloom', tone: 8 },
  },
  {
    handle: 'mayaokonkwo',
    minutes: 1440,
    text: 'Four years ago I wrote that self-custody would stay a power-user feature until it stopped feeling like custody.\n\nStill true. The winning wallet will be the one nobody calls a wallet.',
  },
]

export function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get()
  if (n > 0) return { seeded: false }

  const insertUser = db.prepare(
    `INSERT INTO users
       (id, handle, handle_lower, name, bio, location, website, avatar_tone,
        cover_scene, cover_tone, verified, is_demo, reputation, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  )

  const ids = {}
  for (const person of PEOPLE) {
    const id = randomUUID()
    ids[person.handle] = id
    insertUser.run(
      id,
      person.handle,
      person.handle,
      person.name,
      person.bio,
      person.location ?? null,
      person.website ?? null,
      person.tone,
      person.scene,
      person.tone,
      person.verified ?? 0,
      person.reputation ?? 0,
      minutesAgo(60 * 24 * 400),
      minutesAgo(30),
    )
  }

  const insertPost = db.prepare(
    `INSERT INTO posts (id, author_id, text, media_json, audience, created_at)
     VALUES (?, ?, ?, ?, 'everyone', ?)`,
  )
  for (const post of POSTS) {
    insertPost.run(
      randomUUID(),
      ids[post.handle],
      post.text,
      post.media ? JSON.stringify(post.media) : null,
      minutesAgo(post.minutes),
    )
  }

  // A little social graph among the personas, so follower counts aren't zero.
  const insertFollow = db.prepare(
    'INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)',
  )
  const handles = PEOPLE.map((p) => p.handle)
  handles.forEach((from, i) => {
    for (let step = 1; step <= 4; step++) {
      const to = handles[(i + step) % handles.length]
      if (from !== to) insertFollow.run(ids[from], ids[to], minutesAgo(60 * 24 * 100))
    }
  })

  return { seeded: true, users: PEOPLE.length, posts: POSTS.length }
}
