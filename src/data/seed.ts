/**
 * Local demo data.
 *
 * Accounts, posts, comments, follows, messages and notifications all live on
 * the MESH server now. What remains here is the layer that is still local and
 * labelled as a demo: communities and their access rules, the marketplace,
 * trending topics, and the stand-in wallet balances.
 */

import type {
  Collectible,
  Community,
  MarketplaceItem,
  TokenBalance,
  WalletAccount,
} from '@/types'
import { daysAgo } from '@/lib/utils'

/** The demo wallet. Not a real account — see `services/blockchain/demoProvider.ts`. */
export const DEMO_ACCOUNTS: WalletAccount[] = [
  {
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976A',
    label: 'Main',
    chainId: null,
    chainName: 'Demo network',
  },
  {
    address: '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
    label: 'Creator',
    chainId: null,
    chainName: 'Demo network',
  },
]

export const DEMO_BALANCES: TokenBalance[] = [
  { symbol: 'ETH', name: 'Ethereum', amount: 0.4283, usdPrice: 2391.69, change24h: 2.4 },
  { symbol: 'USDC', name: 'USD Coin', amount: 204.32, usdPrice: 1, change24h: 0 },
  { symbol: 'MESH', name: 'Mesh', amount: 1250, usdPrice: 0.1249, change24h: 8.1 },
  { symbol: 'RHB', name: 'Ridgeline', amount: 3420, usdPrice: 0.0127, change24h: 12.4 },
]

/* ------------------------------ Communities ------------------------------ */

const community = (
  c: Omit<Community, 'avatar' | 'cover'> & { tone: number; scene: Community['cover']['scene'] },
): Community => ({
  ...c,
  avatar: {
    initials: c.name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
    tone: c.tone,
  },
  cover: { scene: c.scene, tone: c.tone },
})

export const seedCommunities: Community[] = [
  community({
    id: 'c_ridgeline',
    slug: 'ridgeline-builders',
    name: 'Ridgeline Builders',
    handle: 'ridgelinebuilders',
    description: 'A community for builders on Ridgeline Chain.',
    about:
      'Ridgeline Builders is where people shipping onchain applications compare notes. Weekly build calls, an active help channel, and a members-only jobs board. We keep it practical — demos over decks.',
    verified: true,
    members: 48200,
    createdAt: '2021-08-14T09:00:00.000Z',
    category: 'Web3',
    rules: [
      'Ship something before you shill something.',
      'No price talk in the main feed.',
      'Credit the people whose work you build on.',
      'Help requests get answers, not links to the docs.',
    ],
    access: {
      label: 'token',
      anyOf: [
        { kind: 'token', symbol: 'RHB', amount: 100 },
        { kind: 'reputation', min: 500 },
      ],
    },
    credential: { name: 'Ridgeline Builders Membership', supply: 50000 },
    tone: 4,
    scene: 'grid',
  }),
  community({
    id: 'c_aixcrypto',
    slug: 'ai-x-crypto',
    name: 'AI x Crypto',
    handle: 'aixcrypto',
    description: 'Exploring the intersection of AI and blockchain.',
    about:
      'Papers, prototypes and arguments about where machine intelligence and open networks actually meet. Low tolerance for hype in either direction.',
    verified: false,
    members: 32100,
    createdAt: '2023-02-02T09:00:00.000Z',
    category: 'AI',
    rules: ['Link the paper, not the thread about the paper.', 'Benchmarks or it did not happen.'],
    access: { label: 'free', anyOf: [{ kind: 'free' }] },
    tone: 6,
    scene: 'orbit',
  }),
  community({
    id: 'c_creators',
    slug: 'onchain-creators',
    name: 'Onchain Creators',
    handle: 'onchaincreators',
    description: 'Build. Create. Share.',
    about:
      'For artists, writers and musicians publishing work they actually own. Monthly critique sessions and a shared drop calendar.',
    verified: true,
    members: 28700,
    createdAt: '2022-03-27T09:00:00.000Z',
    category: 'Creators',
    rules: ['Original work only.', 'Critique the work, not the person.'],
    access: { label: 'free', anyOf: [{ kind: 'free' }] },
    tone: 8,
    scene: 'bloom',
  }),
  community({
    id: 'c_defi',
    slug: 'defi-alpha',
    name: 'DeFi Alpha',
    handle: 'defialpha',
    description: 'Alpha, insights, and discussions on DeFi.',
    about:
      'A small, high-signal room for people who read the contracts. Access is gated to holders of the DeFi Alpha pass.',
    verified: false,
    members: 19400,
    createdAt: '2021-11-08T09:00:00.000Z',
    category: 'DeFi',
    rules: ['No financial advice. Ever.', 'Disclose your positions.'],
    access: {
      label: 'nft',
      anyOf: [{ kind: 'nft', collection: 'DeFi Alpha Pass', collectionId: 'col_defi', amount: 1 }],
    },
    credential: { name: 'DeFi Alpha Pass', supply: 20000 },
    tone: 5,
    scene: 'prism',
  }),
  community({
    id: 'c_mesh',
    slug: 'mesh-official',
    name: 'MESH Official',
    handle: 'meshofficial',
    description: 'The official MESH community.',
    about:
      'Product updates, roadmap notes and direct access to the team building MESH. Feedback here gets read.',
    verified: true,
    members: 12100,
    createdAt: '2023-01-02T09:00:00.000Z',
    category: 'Official',
    rules: ['Be kind.', 'Bug reports go in the weekly thread.'],
    access: { label: 'free', anyOf: [{ kind: 'free' }] },
    tone: 0,
    scene: 'grid',
  }),
  community({
    id: 'c_buildinpublic',
    slug: 'build-in-public',
    name: 'Build in Public',
    handle: 'buildinpublic',
    description: 'A paid cohort for founders shipping in the open.',
    about:
      'Twelve weeks, one hundred seats, weekly accountability calls. Membership includes the archive and a private feed.',
    verified: false,
    members: 4300,
    createdAt: '2023-06-11T09:00:00.000Z',
    category: 'Founders',
    rules: ['Show up or give up your seat.', 'Numbers, not vibes.'],
    access: { label: 'paid', anyOf: [{ kind: 'paid', price: 10, asset: 'USDC' }] },
    credential: { name: 'Build in Public Seat', supply: 100 },
    tone: 3,
    scene: 'waves',
  }),
  community({
    id: 'c_interface',
    slug: 'interface',
    name: 'Interface',
    handle: 'interface',
    description: 'Design systems, motion, and interface craft.',
    about: 'A quiet room for people who care about spacing. Weekly critique, monthly teardown.',
    verified: false,
    members: 8900,
    createdAt: '2022-09-19T09:00:00.000Z',
    category: 'Design',
    rules: ['Show the file.', 'No dribbble-ware.'],
    access: { label: 'reputation', anyOf: [{ kind: 'reputation', min: 300 }] },
    tone: 11,
    scene: 'prism',
  }),
  community({
    id: 'c_founders',
    slug: 'founders-table',
    name: 'Founders Table',
    handle: 'founderstable',
    description: 'Invite-only. Small room, honest conversations.',
    about: 'Forty founders, one dinner a month, no recordings.',
    verified: false,
    members: 1240,
    createdAt: '2022-01-20T09:00:00.000Z',
    category: 'Founders',
    rules: ['What is said at the table stays at the table.'],
    access: { label: 'invite', anyOf: [{ kind: 'invite' }] },
    tone: 1,
    scene: 'city',
  }),
]

/* ----------------------------- Owned & market ----------------------------- */

export const seedCollectibles: Collectible[] = [
  {
    id: 'nft_1',
    name: 'MESH Genesis Pass #0842',
    collection: 'MESH Genesis',
    collectionId: 'col_genesis',
    scene: 'grid',
    tone: 0,
    acquiredAt: daysAgo(400),
    floor: 0.25,
    floorAsset: 'ETH',
  },
  {
    id: 'nft_2',
    name: 'Morning Studio',
    collection: 'Onchain Creators',
    collectionId: 'col_nadia',
    scene: 'bloom',
    tone: 8,
    acquiredAt: daysAgo(120),
    floor: 8,
    floorAsset: 'USDC',
  },
  {
    id: 'nft_3',
    name: 'Ridgeline Builders #1842',
    collection: 'Ridgeline Builders',
    collectionId: 'col_ridgeline',
    scene: 'prism',
    tone: 4,
    acquiredAt: daysAgo(320),
    floor: 0.04,
    floorAsset: 'ETH',
  },
]

export const seedMarketplace: MarketplaceItem[] = [
  { id: 'mk_1', title: 'MESH Genesis Pass', subtitle: 'Founding member credential', category: 'nft', price: 0.25, asset: 'ETH', metricLabel: 'owners', metricValue: 1200, scene: 'grid', tone: 0, creatorId: 'meshteam', ownedByMe: true, collectionId: 'col_genesis' },
  { id: 'mk_2', title: 'Build in Public', subtitle: '12-week founder cohort', category: 'event', price: 10, asset: 'USDC', metricLabel: 'seats', metricValue: 100, scene: 'waves', tone: 3, creatorId: 'amara' },
  { id: 'mk_3', title: 'Creator Toolkit', subtitle: 'Templates, contracts, checklists', category: 'digital', price: 15, asset: 'USDC', metricLabel: 'owners', metricValue: 542, scene: 'prism', tone: 11, creatorId: 'amara' },
  { id: 'mk_4', title: 'AI Prompt Pack', subtitle: '120 prompts for builders', category: 'digital', price: 5, asset: 'USDC', metricLabel: 'sales', metricValue: 320, scene: 'orbit', tone: 6, creatorId: 'sasha' },
  { id: 'mk_5', title: 'Ridgeline Builders Membership', subtitle: 'Annual community credential', category: 'membership', price: 0.04, asset: 'ETH', metricLabel: 'members', metricValue: 48200, scene: 'grid', tone: 4, creatorId: 'ridgeline', collectionId: 'col_ridgeline' },
  { id: 'mk_6', title: 'Morning Studio', subtitle: 'Open edition, one week', category: 'nft', price: 8, asset: 'USDC', metricLabel: 'collectors', metricValue: 486, scene: 'bloom', tone: 8, creatorId: 'nadia', ownedByMe: true, collectionId: 'col_nadia' },
  { id: 'mk_7', title: 'MESH Meetup — Jakarta', subtitle: 'Kemang · 14 Sep', category: 'event', price: 0, asset: 'USDC', metricLabel: 'seats', metricValue: 16, scene: 'city', tone: 2, creatorId: 'elena' },
  { id: 'mk_8', title: 'DeFi Alpha Pass', subtitle: 'Access to the gated room', category: 'membership', price: 0.12, asset: 'ETH', metricLabel: 'members', metricValue: 19400, scene: 'prism', tone: 5, creatorId: 'omar', collectionId: 'col_defi' },
  { id: 'mk_9', title: 'Interface Teardowns', subtitle: 'Season one archive', category: 'digital', price: 12, asset: 'USDC', metricLabel: 'owners', metricValue: 288, scene: 'prism', tone: 11, creatorId: 'kenji' },
  { id: 'mk_10', title: 'Onchain Data Almanac', subtitle: 'Yearly report, 180 pages', category: 'digital', price: 20, asset: 'USDC', metricLabel: 'sales', metricValue: 914, scene: 'waves', tone: 9, creatorId: 'sasha' },
  { id: 'mk_11', title: 'Peaks — Edition of 100', subtitle: 'Photographic series', category: 'nft', price: 0.06, asset: 'ETH', metricLabel: 'owners', metricValue: 100, scene: 'peaks', tone: 1, creatorId: 'nadia', soldOut: true },
  { id: 'mk_12', title: 'Founders Table Dinner', subtitle: 'Milan · invite only', category: 'event', price: 0, asset: 'USDC', metricLabel: 'seats', metricValue: 40, scene: 'city', tone: 1, creatorId: 'elena', soldOut: true },
]

/* ------------------------------- Discovery ------------------------------- */

export interface Trend {
  id: string
  topic: string
  posts: number
  category: string
}

export const seedTrends: Trend[] = [
  { id: 't_1', topic: '#OnchainSocial', posts: 12400, category: 'Trending in Technology' },
  { id: 't_2', topic: 'Ridgeline Chain', posts: 8200, category: 'Web3 · Trending' },
  { id: 't_3', topic: 'SocialFi', posts: 6100, category: 'Trending' },
  { id: 't_4', topic: 'Creator Economy', posts: 5400, category: 'Business · Trending' },
  { id: 't_5', topic: 'MESH', posts: 4800, category: 'Trending in Indonesia' },
  { id: 't_6', topic: '#BuildInPublic', posts: 3900, category: 'Founders · Trending' },
  { id: 't_7', topic: 'Account Abstraction', posts: 2700, category: 'Technology' },
  { id: 't_8', topic: '#DesignSystems', posts: 2100, category: 'Design · Trending' },
]

/** Follows the current user already has. */
