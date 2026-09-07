import type { AppState } from '@/store/appStore'
import type { Collectible, Community, MarketplaceItem, Post, User } from '@/types'
import type { Trend } from '@/data/seed'

export interface SearchResults {
  query: string
  people: User[]
  communities: Community[]
  posts: Post[]
  collectibles: Array<Collectible | MarketplaceItem>
  trends: Trend[]
  total: number
}

const norm = (s: string) => s.toLowerCase().trim()

/**
 * Local search across the seeded dataset. A server-backed implementation would
 * replace this module wholesale; callers only depend on `SearchResults`.
 */
export function search(state: AppState, rawQuery: string, limit = 8): SearchResults {
  const query = norm(rawQuery)
  if (!query) {
    return { query: rawQuery, people: [], communities: [], posts: [], collectibles: [], trends: [], total: 0 }
  }

  const terms = query.split(/\s+/).filter(Boolean)
  const matches = (...fields: Array<string | undefined>) => {
    const haystack = norm(fields.filter(Boolean).join(' '))
    return terms.every((t) => haystack.includes(t))
  }

  const people = state.users
    .filter((u) => matches(u.name, u.handle, u.bio, u.location))
    .sort((a, b) => b.followers - a.followers)
    .slice(0, limit)

  const communities = state.communities
    .filter((c) => matches(c.name, c.handle, c.description, c.category))
    .sort((a, b) => b.members - a.members)
    .slice(0, limit)

  const posts = state.posts
    .filter((p) => {
      const author = state.users.find((u) => u.id === p.authorId)
      return matches(p.text, author?.name, author?.handle)
    })
    .sort((a, b) => b.likes - a.likes)
    .slice(0, limit)

  const collectibles = [
    ...state.marketplace.filter((m) => matches(m.title, m.subtitle)),
    ...state.collectibles.filter((c) => matches(c.name, c.collection)),
  ].slice(0, limit)

  const trends = state.trends.filter((t) => matches(t.topic, t.category)).slice(0, limit)

  return {
    query: rawQuery,
    people,
    communities,
    posts,
    collectibles,
    trends,
    total: people.length + communities.length + posts.length + collectibles.length,
  }
}
