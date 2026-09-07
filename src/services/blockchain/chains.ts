import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  sepolia,
  type Chain,
} from 'viem/chains'
import { defineChain } from 'viem'

/**
 * Networks MESH knows about.
 *
 * Mainnets first — this is a payments surface, not a sandbox. Testnets are
 * listed too and marked, because the difference between test ether and real
 * money should never come down to remembering which chain you were on.
 *
 * The list is not closed. Any chain can be added at runtime by pasting its own
 * published parameters (see `customChains` below), and MESH will also work on
 * whatever network a wallet is already on, even one it has never heard of.
 */

/**
 * Robinhood Chain — an Arbitrum Orbit L2 settling to Ethereum, ETH native.
 *
 * Parameters cross-checked against the ethereum-lists/chains registry entry
 * `eip155-4663.json`, which is what chainlist.org and chainid.network publish.
 *
 * The registry lists several RPCs and explorers. The ones chosen here are the
 * two that cannot be domain-squatted: the RPC on Robinhood's own domain, and
 * Blockscout's hosted explorer. There is a known ecosystem of lookalike RPCs
 * and fake explorers around this chain, so after switching, confirm your wallet
 * reports chain 4663 before sending anything.
 */
export const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
  contracts: {
    // The canonical Multicall3 deployment, confirmed to hold bytecode on this
    // chain. Lets viem fold a page of reads into one request.
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
})

/**
 * The RPC MESH itself reads Robinhood Chain through.
 *
 * The chain's own public endpoint is rate-limited and, from a browser,
 * occasionally answers with a malformed CORS header — which is a page that
 * renders or does not depending on luck. A dedicated provider fixes both.
 *
 * `VITE_RPC_URL` takes a full URL for any provider; `VITE_ALCHEMY_API_KEY` is
 * the shortcut for Alchemy, which serves this chain natively. Neither is
 * required: unset, this falls back to the endpoint the chain publishes and
 * everything still works.
 *
 * Deliberately NOT used for `wallet_addEthereumChain`. That writes an RPC into
 * the user's own wallet, permanently, and a key of ours has no business living
 * in thousands of other people's wallet settings — see `addChainParams`, which
 * keeps handing out the public endpoint.
 */
export function robinhoodRpcUrl(): string {
  const explicit = (import.meta.env.VITE_RPC_URL ?? '').trim()
  if (explicit) return explicit

  const alchemyKey = (import.meta.env.VITE_ALCHEMY_API_KEY ?? '').trim()
  if (alchemyKey) return `https://robinhood-mainnet.g.alchemy.com/v2/${alchemyKey}`

  return robinhoodChain.rpcUrls.default.http[0]
}

export const KNOWN_CHAINS: Chain[] = [
  mainnet,
  robinhoodChain,
  base,
  arbitrum,
  optimism,
  polygon,
  sepolia,
  baseSepolia,
]

export interface TokenConfig {
  symbol: string
  name: string
  address: `0x${string}`
  decimals: number
}

/**
 * ERC-20s per chain id. Native currency is handled separately.
 *
 * These are a starting point, never a source of truth: on connect, every
 * contract is checked against the chain by reading its own `symbol()` and
 * `decimals()`. A mismatch drops the token rather than showing a balance for —
 * or offering to send to — an address that is not what this table claims.
 */
export const TOKENS: Record<number, TokenConfig[]> = {
  [mainnet.id]: [
    { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  ],
  [base.id]: [
    { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  ],
  [arbitrum.id]: [
    { symbol: 'USDC', name: 'USD Coin', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
  ],
  [optimism.id]: [
    { symbol: 'USDC', name: 'USD Coin', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
  ],
  [polygon.id]: [
    { symbol: 'USDC', name: 'USD Coin', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
  ],
  [sepolia.id]: [
    { symbol: 'USDC', name: 'USD Coin (testnet)', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
  ],
  [baseSepolia.id]: [
    { symbol: 'USDC', name: 'USD Coin (testnet)', address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6 },
  ],
}

/* --------------------------- Custom networks --------------------------- */

export interface CustomChainInput {
  id: number
  name: string
  /** Native currency ticker, e.g. ETH. */
  symbol: string
  decimals?: number
  rpcUrl: string
  explorerUrl?: string
  testnet?: boolean
}

const CUSTOM_KEY = 'mesh.chains.v1'

/**
 * Networks the user added themselves.
 *
 * MESH ships parameters only for chains it can state with confidence. For
 * anything else — a new L2, a private network — paste the values the chain
 * itself publishes. Guessing a chain id or RPC on someone's behalf is how funds
 * get sent somewhere they cannot be recovered from.
 */
export function loadCustomChains(): CustomChainInput[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    return raw ? (JSON.parse(raw) as CustomChainInput[]) : []
  } catch {
    return []
  }
}

function persist(chains: CustomChainInput[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(chains))
  } catch {
    /* storage unavailable — the network lasts for this session only */
  }
}

export function saveCustomChain(input: CustomChainInput) {
  const rest = loadCustomChains().filter((c) => c.id !== input.id)
  persist([...rest, input])
}

export function removeCustomChain(id: number) {
  persist(loadCustomChains().filter((c) => c.id !== id))
}

export const toViemChain = (c: CustomChainInput): Chain =>
  defineChain({
    id: c.id,
    name: c.name,
    nativeCurrency: { name: c.symbol, symbol: c.symbol, decimals: c.decimals ?? 18 },
    rpcUrls: { default: { http: [c.rpcUrl] } },
    blockExplorers: c.explorerUrl
      ? { default: { name: 'Explorer', url: c.explorerUrl } }
      : undefined,
    testnet: c.testnet,
  })

/** Everything selectable: what ships, plus whatever the user added. */
export function allChains(): Chain[] {
  const custom = loadCustomChains().map(toViemChain)
  const customIds = new Set(custom.map((c) => c.id))
  return [...custom, ...KNOWN_CHAINS.filter((c) => !customIds.has(c.id))]
}

export const chainById = (id: number): Chain | undefined =>
  allChains().find((c) => c.id === id)

export const isTestnet = (id: number) => !!chainById(id)?.testnet

/**
 * The parameters a wallet needs to add a network it does not know yet.
 *
 * Covers chains MESH ships as well as ones the user added, since a wallet is
 * just as likely to be missing a newer L2 as a private network. Returns null
 * when there is no RPC to offer — better to fail than to propose an endpoint
 * nobody specified.
 */
export function addChainParams(id: number) {
  const custom = loadCustomChains().find((c) => c.id === id)
  if (custom) {
    return {
      chainId: `0x${id.toString(16)}`,
      chainName: custom.name,
      nativeCurrency: {
        name: custom.symbol,
        symbol: custom.symbol,
        decimals: custom.decimals ?? 18,
      },
      rpcUrls: [custom.rpcUrl],
      ...(custom.explorerUrl ? { blockExplorerUrls: [custom.explorerUrl] } : {}),
    }
  }

  const known = KNOWN_CHAINS.find((c) => c.id === id)
  const rpc = known?.rpcUrls.default.http[0]
  if (!known || !rpc) return null

  const explorer = known.blockExplorers?.default?.url
  return {
    chainId: `0x${id.toString(16)}`,
    chainName: known.name,
    nativeCurrency: known.nativeCurrency,
    rpcUrls: [rpc],
    ...(explorer ? { blockExplorerUrls: [explorer] } : {}),
  }
}

/* ------------------------------- Explorers ------------------------------- */

export function explorerTxUrl(chainId: number, hash: string): string | undefined {
  const url = chainById(chainId)?.blockExplorers?.default?.url
  return url ? `${url.replace(/\/$/, '')}/tx/${hash}` : undefined
}

export function explorerAddressUrl(chainId: number, address: string): string | undefined {
  const url = chainById(chainId)?.blockExplorers?.default?.url
  return url ? `${url.replace(/\/$/, '')}/address/${address}` : undefined
}
