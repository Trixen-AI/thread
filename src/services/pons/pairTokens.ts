import type { Address } from 'viem'

/**
 * Quote assets a pons v2 launch can be paired against, besides native ETH.
 *
 * This list is a starting point, never a source of truth. pons approves pair
 * assets on the factory and can stop allowing new launches against one at any
 * time, so every entry is re-checked against the chain before it is offered:
 * `approvedPairTokens()` and `pairTokenEconomics()` on the factory, plus the
 * token's own `symbol()` and `decimals()`. Anything that disagrees is dropped
 * rather than shown — the same rule MESH already applies to its own token
 * registry in `services/blockchain/chains.ts`.
 *
 * Discovered by reading `TokenLaunched` logs from the factory and keeping every
 * distinct pair asset the factory still approves. Ordered by how many launches
 * have actually used each one, so the create form offers the common ones first.
 */
export interface PairTokenConfig {
  address: Address
  symbol: string
  name: string
  decimals: number
}

export const PAIR_TOKEN_CANDIDATES: PairTokenConfig[] = [
  { address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', symbol: 'USDG', name: 'Global Dollar', decimals: 6 },
  { address: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', symbol: 'NVDA', name: 'NVIDIA • Robinhood Token', decimals: 18 },
  { address: '0x1D11f0496982706C5e14A514D4E79F2e6BdE4516', symbol: 'DJT', name: 'Trump Media & Technology Group • Robinhood Token', decimals: 18 },
  { address: '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa', symbol: 'SPCX', name: 'Space Exploration Technologies Corp. Class A Common Stock • Robinhood Token', decimals: 18 },
  { address: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C', symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust • Robinhood Token', decimals: 18 },
  { address: '0x322F0929c4625eD5bAd873c95208D54E1c003b2d', symbol: 'TSLA', name: 'Tesla • Robinhood Token', decimals: 18 },
  { address: '0xf3081494B87e8D5fb7960f066E931D1D0e6E3d67', symbol: 'TAO', name: 'Bittensor', decimals: 18 },
  { address: '0x12f190a9F9d7D37a250758b26824B97CE941bF54', symbol: 'AMZN', name: 'Amazon • Robinhood Token', decimals: 18 },
  { address: '0xD5f3879160bc7c32ebb4dC785F8a4F505888de68', symbol: 'QQQ', name: 'Invesco QQQ • Robinhood Token', decimals: 18 },
  { address: '0x1b0E319c6A659F002271B69dB8A7df2F911c153E', symbol: 'GME', name: 'GameStop • Robinhood Token', decimals: 18 },
  { address: '0xC9a981FEE1F9DEc688bb123ccDeCc63D0deBFC4e', symbol: 'GLD', name: 'SPDR Gold Trust • Robinhood Token', decimals: 18 },
  { address: '0x05b37Fb53A299a1b874A619e1c4C404D52C36F4C', symbol: 'RDDT', name: 'Reddit • Robinhood Token', decimals: 18 },
  { address: '0xCceE82fE024c36fA15E1005edE3E9e4787e23D09', symbol: 'HIMS', name: 'Hims & Hers Health • Robinhood Token', decimals: 18 },
  { address: '0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A', symbol: 'PLTR', name: 'Palantir Technologies • Robinhood Token', decimals: 18 },
  { address: '0x05a3d1Cd21d0C88145E82600E62e7E496e0F222B', symbol: 'AMC', name: 'AMC Entertainment • Robinhood Token', decimals: 18 },
  { address: '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3', symbol: 'GOOGL', name: 'Alphabet Class A • Robinhood Token', decimals: 18 },
  { address: '0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5', symbol: 'SGOV', name: 'iShares 0-3 Month Treasury Bond • Robinhood Token', decimals: 18 },
  { address: '0x86923f96303D656E4aa86D9d42D1e57ad2023fdC', symbol: 'AMD', name: 'AMD • Robinhood Token', decimals: 18 },
  { address: '0xe93237C50D904957Cf27E7B1133b510C669c2e74', symbol: 'MSFT', name: 'Microsoft • Robinhood Token', decimals: 18 },
  { address: '0xF0C4BF4C582cb3836e98394b1d4e7B7281101bE8', symbol: 'RBLX', name: 'Roblox • Robinhood Token', decimals: 18 },
  { address: '0xec262a75e413fAfD0dF80480274532C79D42da09', symbol: 'MSTR', name: 'Strategy Inc. • Robinhood Token', decimals: 18 },
  { address: '0x4e62068525Ab11FE768e29dfD00ef909B9803016', symbol: 'LULU', name: 'Lululemon • Robinhood Token', decimals: 18 },
  { address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', symbol: 'AAPL', name: 'Apple • Robinhood Token', decimals: 18 },
  { address: '0x6330D8C3178a418788dF01a47479c0ce7CCF450b', symbol: 'COIN', name: 'Coinbase • Robinhood Token', decimals: 18 },
  { address: '0x43B07D15cE533bEc5476d70C22a78a1B2B662155', symbol: 'MRNA', name: 'Moderna • Robinhood Token', decimals: 18 },
  { address: '0xf23250dac154D05Bb671CB0d0eBEf3c635c79CE2', symbol: 'UPS', name: 'UPS • Robinhood Token', decimals: 18 },
  { address: '0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35', symbol: 'META', name: 'Meta Platforms • Robinhood Token', decimals: 18 },
  { address: '0xACEF2e09adb47aD6aBeBAD9fF06689E60615C2B6', symbol: 'INDA', name: 'iShares MSCI India ETF • Robinhood Token', decimals: 18 },
  { address: '0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4', symbol: 'BABA', name: 'Alibaba • Robinhood Token', decimals: 18 },
  { address: '0x7066A64c24e4206CD62E83bf198c1E7EB361F51e', symbol: 'PFE', name: 'Pfizer • Robinhood Token', decimals: 18 },
  { address: '0x8005d266423c7ea827372c9c864491e5786600ea', symbol: 'LLY', name: 'Eli Lilly • Robinhood Token', decimals: 18 },
  { address: '0xF6589F11Bc40b669e584073F428B05562F568733', symbol: 'SNAP', name: 'Snap • Robinhood Token', decimals: 18 },
  { address: '0xCEC185eB182c47d1bA1EFc84e6959e18cd620Be4', symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', decimals: 8 },
  { address: '0x4EA005168D7F09a7A0Ba9D1DEf21a479950E44C2', symbol: 'COST', name: 'Costco • Robinhood Token', decimals: 18 },
  { address: '0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8', symbol: 'NFLX', name: 'Netflix • Robinhood Token', decimals: 18 },
  { address: '0x25C288E6D899b9BC30160965aD9644c67e73bE0C', symbol: 'F', name: 'Ford Motor • Robinhood Token', decimals: 18 },
  { address: '0xceF9027c7d6985b85f0BA431125073529A947A68', symbol: 'BULL', name: 'Webull • Robinhood Token', decimals: 18 },
  { address: '0xB90A19fF0Af67f7779afF50A882A9CfF42446400', symbol: 'SNDK', name: 'Sandisk Corporation • Robinhood Token', decimals: 18 },
  { address: '0x41F4267525a8AFf329540eF24fD83d9044758B33', symbol: 'FIG', name: 'Figma • Robinhood Token', decimals: 18 },
  { address: '0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f', symbol: 'SLV', name: 'iShares Silver Trust • Robinhood Token', decimals: 18 },
  { address: '0x980dcf6766FA79f5Cf0c4AAdb3ab477ff15a9619', symbol: 'IBM', name: 'IBM • Robinhood Token', decimals: 18 },
  { address: '0x48E39E56aCdbA37b09020C0b734A613C9a2f100A', symbol: 'BB', name: 'Blackberry • Robinhood Token', decimals: 18 },
  { address: '0x03DfbBE0AC4E7bCDaFd08eD41A400326B77D8c80', symbol: 'JNJ', name: 'Johnson & Johnson • Robinhood Token', decimals: 18 },
  { address: '0x58FfE4a942d3885bAa22D7520691F611EF09e7AA', symbol: 'TSM', name: 'Taiwan Semiconductor Manufacturing • Robinhood Token', decimals: 18 },
  { address: '0xF53F66751B1Eff985311b693531E3290F600c410', symbol: 'SHOP', name: 'Shopify • Robinhood Token', decimals: 18 },
  { address: '0x5e81213613b6B86EaB4c6c50d718d34359459786', symbol: 'TTWO', name: 'Take-Two Interactive Software • Robinhood Token', decimals: 18 },
  { address: '0x941AE714EC6D8130c7B75d67160Ca08f1e7d11Dd', symbol: 'DELL', name: 'Dell • Robinhood Token', decimals: 18 },
  { address: '0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344', symbol: 'USO', name: 'United States Oil Fund • Robinhood Token', decimals: 18 },
  { address: '0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5', symbol: 'CRCL', name: 'Circle Internet Group • Robinhood Token', decimals: 18 },
  { address: '0x408c14038a04f7bD235329E26d2bf569ee20e250', symbol: 'NU', name: 'Nu • Robinhood Token', decimals: 18 },
  { address: '0x84CAb63bc87912E71ad199ff14A0bA45de68FeF8', symbol: 'SKHY', name: 'SK hynix Inc. American Depositary Shares • Robinhood Token', decimals: 18 },
  { address: '0x822CC93fFD030293E9842c30BBD678F530701867', symbol: 'BE', name: 'Bloom Energy • Robinhood Token', decimals: 18 },
  { address: '0x62fd0668e10D8B72339BE2DCF7643001688ff13B', symbol: 'MRVL', name: 'Marvell Technology • Robinhood Token', decimals: 18 },
]
