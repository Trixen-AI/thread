/**
 * MESH domain model.
 *
 * Two clearly separated layers:
 *   SOCIAL  — users, profiles, posts, comments, follows, messages, notifications
 *   ONCHAIN — wallets, identity, ownership, memberships, reputation, payments
 *
 * The social layer never imports from the blockchain services; the blockchain
 * layer never renders UI. Anything that crosses the boundary does so through
 * `src/services/*`.
 */

/* ============================ SOCIAL LAYER ============================ */

export type UserId = string

export interface User {
  id: UserId
  handle: string
  name: string
  bio: string
  avatar: AvatarSeed
  cover: CoverSeed
  verified: boolean
  location?: string
  website?: string
  joinedAt: string // ISO
  followers: number
  following: number
  postCount: number
  /** True for the fictional accounts seeded into a fresh instance. */
  isDemo: boolean
  /** Whether the signed-in viewer follows this account. */
  followedByMe: boolean
  isMe: boolean
  lastSeenAt?: string
  /**
   * Set once the account has proved control of an address by signing a
   * challenge. This is where tips and collects are actually sent.
   */
  walletAddress?: string
  walletChainId?: number
  /** Mock reputation score — see ReputationService for provenance. */
  reputation: number
}

export interface AvatarSeed {
  /** Two-letter monogram rendered on a deterministic gradient. */
  initials: string
  /** Index into the palette in `data/visuals.ts`. */
  tone: number
}

export interface CoverSeed {
  scene: SceneKind
  tone: number
}

export type SceneKind = 'peaks' | 'city' | 'orbit' | 'grid' | 'waves' | 'bloom' | 'prism'

export type PostAudience = 'everyone' | 'followers' | 'community' | 'private'

export interface PostMedia {
  kind: 'image' | 'video'
  scene: SceneKind
  tone: number
  caption?: string
  overline?: string
  /** Object URL for a file the user attached. Falls back to the scene when absent. */
  src?: string
}

export interface PollOption {
  id: string
  label: string
  votes: number
}

export interface Poll {
  options: PollOption[]
  endsAt: string
  votedOptionId?: string
}

export interface PostEvent {
  title: string
  startsAt: string
  location: string
  attending: number
  isAttending?: boolean
}

/** A post that the author has made collectible. Ownership settles onchain later. */
export interface CollectConfig {
  price: number
  asset: TokenSymbol
  collectors: number
  earned: number
  /** Cap on editions, when the creator set one. */
  edition?: number
  collectedByMe?: boolean
}

/**
 * A pons v2 launch attached to a post.
 *
 * The post is the token's thread on MESH. The chain is the source of truth for
 * everything about the token — this carries only what a card needs to render
 * and link without a read, and the address that resolves the rest.
 */
export interface TokenAttachment {
  chainId: number
  address: string
  curve: string
  name: string
  symbol: string
  /** What the launch is priced in — ETH, or a pair asset's symbol. */
  quoteSymbol: string
  logo?: string
  /** The launch transaction, when this post announced the launch. */
  launchTx?: string
}

export interface Post {
  id: string
  authorId: UserId
  createdAt: string
  text: string
  media?: PostMedia
  poll?: Poll
  event?: PostEvent
  collectible?: CollectConfig
  token?: TokenAttachment
  communityId?: string
  audience: PostAudience
  location?: string
  likes: number
  comments: number
  reposts: number
  tipsReceived: number
  likedByMe: boolean
  repostedByMe: boolean
  bookmarkedByMe: boolean
}

export interface Comment {
  id: string
  postId: string
  authorId: UserId
  text: string
  createdAt: string
  likes: number
  likedByMe: boolean
}

export interface Story {
  id: string
  authorId: UserId
  scene: SceneKind
  tone: number
  createdAt: string
  seen: boolean
  /** "Your story" placeholder card. */
  isOwn?: boolean
}

/* ---------------------------- Communities ---------------------------- */

export type AccessKind =
  | 'free'
  | 'token'
  | 'nft'
  | 'reputation'
  | 'paid'
  | 'invite'

/** A single condition a member must satisfy. Conditions in a rule are OR'd. */
export type AccessCondition =
  | { kind: 'free' }
  | { kind: 'token'; symbol: TokenSymbol; amount: number }
  | { kind: 'nft'; collection: string; collectionId: string; amount: number }
  | { kind: 'reputation'; min: number }
  | { kind: 'paid'; price: number; asset: TokenSymbol }
  | { kind: 'invite' }

export interface AccessRule {
  /** Headline badge shown on cards. */
  label: AccessKind
  /** Satisfying ANY condition grants access. */
  anyOf: AccessCondition[]
}

export interface Community {
  id: string
  slug: string
  name: string
  handle: string
  description: string
  about: string
  avatar: AvatarSeed
  cover: CoverSeed
  verified: boolean
  members: number
  createdAt: string
  rules: string[]
  access: AccessRule
  category: string
  /** Membership credential template, if this community issues one. */
  credential?: {
    name: string
    supply: number
  }
}

export interface CommunityMember {
  communityId: string
  userId: UserId
  role: 'owner' | 'moderator' | 'member'
  joinedAt: string
  memberNumber: number
}

/* ---------------------------- Messaging ---------------------------- */

export type MessageAttachment =
  | { kind: 'image'; scene: SceneKind; tone: number }
  | { kind: 'file'; name: string; size: string }
  | { kind: 'payment'; amount: number; asset: TokenSymbol; note?: string; demo: true }
  | { kind: 'invite'; communityId: string }

export interface Message {
  id: string
  conversationId: string
  senderId: UserId
  text: string
  createdAt: string
  attachment?: MessageAttachment
}

export interface Conversation {
  id: string
  /** Participants excluding the current user for DMs. */
  participantIds: UserId[]
  communityId?: string
  unread: number
  lastMessageAt: string
  muted?: boolean
}

/* ---------------------------- Notifications ---------------------------- */

export type NotificationKind =
  | 'like'
  | 'comment'
  | 'follow'
  | 'community_invite'
  | 'tip'
  | 'badge'
  | 'wallet'
  | 'collect'
  | 'mention'

export interface Notification {
  id: string
  kind: NotificationKind
  actorId?: UserId
  postId?: string
  communityId?: string
  amount?: number
  asset?: TokenSymbol
  badge?: string
  text?: string
  createdAt: string
  read: boolean
}

/* ============================ ONCHAIN LAYER ============================ */

export type TokenSymbol = 'ETH' | 'USDC' | 'MESH' | 'RHB'

export interface TokenBalance {
  symbol: TokenSymbol
  name: string
  amount: number
  /**
   * Unit price in USD. `null` when no price feed is configured — a real chain
   * without a price source shows balances, never an invented dollar value.
   */
  usdPrice: number | null
  change24h: number | null
}

export interface Collectible {
  id: string
  name: string
  collection: string
  collectionId: string
  scene: SceneKind
  tone: number
  ownerId?: UserId
  acquiredAt?: string
  floor?: number
  floorAsset?: TokenSymbol
}

export interface Membership {
  id: string
  communityId: string
  memberNumber: number
  status: 'active' | 'expired'
  issuedAt: string
  /** Where the credential lives. `wallet` once a real contract is wired up. */
  custody: 'wallet' | 'mesh-account'
}

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface WalletAccount {
  address: string
  label: string
  /** Chain the account is currently on. `null` while mocked and unconfigured. */
  chainId: number | null
  chainName: string
}

export interface WalletState {
  status: WalletStatus
  account: WalletAccount | null
  accounts: WalletAccount[]
  balances: TokenBalance[]
  error?: string
  /** True whenever the active provider is the local demo provider. */
  isDemo: boolean
}

/**
 * The outcome of a value transfer.
 *
 * `settlement` is deliberately explicit: the demo provider returns
 * `{ kind: 'demo' }` and never invents a transaction hash. Only a provider
 * that actually broadcast a transaction returns `{ kind: 'onchain', hash }`.
 */
export type Settlement =
  | { kind: 'demo'; reference: string }
  | { kind: 'onchain'; hash: string; chainId: number; explorerUrl?: string }

export interface TransferReceipt {
  id: string
  createdAt: string
  amount: number
  asset: TokenSymbol
  direction: 'out' | 'in'
  counterparty: string
  memo?: string
  settlement: Settlement
}

export type TxPhase = 'idle' | 'confirming' | 'pending' | 'success' | 'error'

/* ---------------------------- Marketplace ---------------------------- */

export type MarketCategory = 'nft' | 'membership' | 'event' | 'digital'

export interface MarketplaceItem {
  id: string
  title: string
  subtitle: string
  category: MarketCategory
  price: number
  asset: TokenSymbol
  /** Set when buying this item grants a collectible that gates can check. */
  collectionId?: string
  /** Owners for collectibles, seats for events, sales for digital goods. */
  metricLabel: string
  metricValue: number
  scene: SceneKind
  tone: number
  creatorId: UserId
  ownedByMe?: boolean
  soldOut?: boolean
}

/* ---------------------------- UI plumbing ---------------------------- */

export interface Toast {
  id: string
  title: string
  description?: string
  tone: 'default' | 'success' | 'error' | 'brand'
  icon?: 'check' | 'wallet' | 'heart' | 'users' | 'coins' | 'alert'
}

export type SearchScope = 'top' | 'people' | 'posts' | 'communities' | 'collectibles'

/** What the composer submits. Mirrors the server's create-post body. */
export interface PostDraft {
  text: string
  media?: PostMedia
  audience: PostAudience
  communityId?: string
  collectible?: { price: number; asset: TokenSymbol }
  token?: TokenAttachment
  poll?: Poll
  event?: PostEvent
  location?: string
}
