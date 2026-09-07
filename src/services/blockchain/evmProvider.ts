import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  type Address,
  type EIP1193Provider,
  type PublicClient,
  type WalletClient,
} from 'viem'
import type { Collectible, TokenBalance, TransferReceipt, WalletAccount } from '@/types'
import { uid } from '@/lib/utils'
import type { ChainProvider, OwnershipProof, TransferRequest } from './provider'
import { TOKENS, addChainParams, chainById, explorerTxUrl } from './chains'
import { getWallets, rememberWallet, type WalletOption } from './wallets'

/**
 * A real EVM wallet, over EIP-1193.
 *
 * Everything here talks to the chain the user's wallet is on, using that
 * wallet as the transport — so MESH needs no RPC keys of its own and the user
 * keeps custody of every signature.
 *
 * What it deliberately does not do: invent prices it has no feed for, or
 * enumerate NFTs it has no indexer for. Those come back empty and the UI says
 * why, rather than showing plausible numbers.
 */

type ChangeListener = () => void

class EvmProvider implements ChainProvider {
  readonly id = 'evm'
  readonly isDemo = false

  private wallet: WalletOption | null = null
  private walletClient: WalletClient | null = null
  private publicClient: PublicClient | null = null
  private accounts: Address[] = []
  private chainId: number | null = null
  private history: TransferReceipt[] = []
  private listeners = new Set<ChangeListener>()
  /** Token configs confirmed against the chain, per chain id. */
  private verified = new Map<number, TokenConfigChecked[]>()

  get label() {
    return this.wallet?.name ?? 'Browser wallet'
  }

  /**
   * Direct access to the signer, for contract integrations that need more than
   * the `ChainProvider` seam expresses.
   *
   * `ChainProvider` is deliberately chain-agnostic — it says nothing about
   * calldata, because a non-EVM provider could satisfy it. A protocol
   * integration is the opposite: it is EVM-specific by definition and pinned to
   * one chain. So it reaches for these rather than widening the seam with
   * methods only one implementation could ever answer.
   */
  get account(): Address | null {
    return this.accounts[0] ?? null
  }

  get currentChainId(): number | null {
    return this.chainId
  }

  get connected(): boolean {
    return this.accounts.length > 0
  }

  /** The wallet client for signing. Null until a wallet is connected. */
  signer(): WalletClient | null {
    return this.walletClient
  }

  /**
   * Puts the wallet on `chainId`, switching (or adding, then switching) only
   * when it is not already there — so a user on the right network is never
   * shown a prompt they do not need.
   */
  async ensureChain(chainId: number): Promise<void> {
    if (this.chainId === chainId) return
    await this.switchChain(chainId)
  }

  onChange(listener: ChangeListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  /** Which installed wallet to use. Called before `connect`. */
  select(wallet: WalletOption) {
    this.detach()
    this.wallet = wallet
  }

  private attach(raw: EIP1193Provider) {
    raw.on?.('accountsChanged', this.handleAccounts)
    raw.on?.('chainChanged', this.handleChain)
  }

  private detach() {
    const raw = this.wallet?.provider
    raw?.removeListener?.('accountsChanged', this.handleAccounts)
    raw?.removeListener?.('chainChanged', this.handleChain)
  }

  private handleAccounts = (accounts: unknown) => {
    this.accounts = ((accounts as string[]) ?? []).map((a) => getAddress(a))
    this.notify()
  }

  private handleChain = (chainId: unknown) => {
    this.chainId = Number(chainId)
    this.verified.delete(this.chainId)
    this.buildClients()
    this.notify()
  }

  private buildClients() {
    if (!this.wallet) return
    const chain = this.chainId ? chainById(this.chainId) : undefined
    const transport = custom(this.wallet.provider)
    this.walletClient = createWalletClient({ chain, transport })
    this.publicClient = createPublicClient({ chain, transport }) as PublicClient
  }

  async connect(): Promise<WalletAccount[]> {
    if (!this.wallet) {
      const [first] = getWallets()
      if (!first) throw new Error('No browser wallet found. Install one and reload.')
      this.wallet = first
    }

    const raw = this.wallet.provider
    const requested = (await raw.request({ method: 'eth_requestAccounts' })) as string[]
    if (!requested?.length) throw new Error('The wallet returned no accounts')

    this.accounts = requested.map((a) => getAddress(a))
    this.chainId = Number(await raw.request({ method: 'eth_chainId' }))
    this.buildClients()
    this.attach(raw)
    rememberWallet(this.wallet.id)

    return this.describeAccounts()
  }

  /** Reconnects silently if the wallet already has this site authorised. */
  async reconnect(): Promise<WalletAccount[]> {
    if (!this.wallet) return []
    const raw = this.wallet.provider
    const existing = (await raw.request({ method: 'eth_accounts' })) as string[]
    if (!existing?.length) return []

    this.accounts = existing.map((a) => getAddress(a))
    this.chainId = Number(await raw.request({ method: 'eth_chainId' }))
    this.buildClients()
    this.attach(raw)
    return this.describeAccounts()
  }

  private describeAccounts(): WalletAccount[] {
    const chain = this.chainId ? chainById(this.chainId) : undefined
    return this.accounts.map((address, i) => ({
      address,
      label: i === 0 ? 'Main' : `Account ${i + 1}`,
      chainId: this.chainId,
      chainName: chain?.name ?? (this.chainId ? `Chain ${this.chainId}` : 'Unknown network'),
    }))
  }

  async disconnect(): Promise<void> {
    this.detach()
    // A transport with a session outside the page has to end it too — see
    // WalletOption.disconnect.
    await this.wallet?.disconnect?.().catch(() => {})
    this.accounts = []
    this.chainId = null
    this.walletClient = null
    this.publicClient = null
    this.wallet = null
    this.verified.clear()
    rememberWallet(null)
  }

  async getAccounts(): Promise<WalletAccount[]> {
    return this.describeAccounts()
  }

  /**
   * Confirms each configured token really is what the registry claims, by
   * reading `symbol()` and `decimals()` from the contract itself. Anything
   * that disagrees is dropped and never offered for a transfer.
   */
  private async verifyTokens(chainId: number): Promise<TokenConfigChecked[]> {
    const cached = this.verified.get(chainId)
    if (cached) return cached
    const client = this.publicClient
    const configured = TOKENS[chainId] ?? []
    if (!client || !configured.length) {
      this.verified.set(chainId, [])
      return []
    }

    const checked = await Promise.all(
      configured.map(async (token) => {
        try {
          const [symbol, decimals] = await Promise.all([
            client.readContract({
              address: token.address,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            client.readContract({
              address: token.address,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
          ])
          const symbolMatches = symbol.toUpperCase() === token.symbol.toUpperCase()
          if (!symbolMatches || decimals !== token.decimals) return null
          return { ...token, decimals } satisfies TokenConfigChecked
        } catch {
          return null
        }
      }),
    )

    const good = checked.filter((t): t is TokenConfigChecked => t !== null)
    this.verified.set(chainId, good)
    return good
  }

  async getBalances(address: string): Promise<TokenBalance[]> {
    const client = this.publicClient
    if (!client || !this.chainId) return []
    const account = getAddress(address)
    const chain = chainById(this.chainId)

    const native = await client.getBalance({ address: account })
    const balances: TokenBalance[] = [
      {
        symbol: (chain?.nativeCurrency.symbol ?? 'ETH') as TokenBalance['symbol'],
        name: chain?.nativeCurrency.name ?? `Chain ${this.chainId} native token`,
        amount: Number(formatUnits(native, chain?.nativeCurrency.decimals ?? 18)),
        // No price feed is configured, so no price is claimed.
        usdPrice: null,
        change24h: null,
      },
    ]

    for (const token of await this.verifyTokens(this.chainId)) {
      try {
        const raw = await client.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        })
        balances.push({
          symbol: token.symbol as TokenBalance['symbol'],
          name: token.name,
          amount: Number(formatUnits(raw, token.decimals)),
          usdPrice: null,
          change24h: null,
        })
      } catch {
        /* a token that cannot be read is simply not listed */
      }
    }

    return balances
  }

  /** Enumerating NFTs needs an indexer, which is not configured. */
  async getCollectibles(): Promise<Collectible[]> {
    return []
  }

  /** A real signature from the user's key, verifiable by anyone. */
  async proveOwnership(address: string, statement: string): Promise<OwnershipProof> {
    if (!this.walletClient) throw new Error('Wallet not connected')
    const account = getAddress(address)
    const signature = await this.walletClient.signMessage({ account, message: statement })
    return {
      address: account,
      statement,
      issuedAt: new Date().toISOString(),
      signature,
      // The signature is real, but only the server's check makes it *verified*.
      verified: false,
    }
  }

  async switchChain(chainId: number) {
    const raw = this.wallet?.provider
    if (!raw) throw new Error('Wallet not connected')

    try {
      await raw.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })
    } catch (error) {
      // 4902 means the wallet has never heard of this chain.
      const unknown =
        typeof error === 'object' && error !== null && (error as { code?: number }).code === 4902
      const params = addChainParams(chainId)
      if (!unknown || !params) throw error

      await raw.request({ method: 'wallet_addEthereumChain', params: [params] })
      await raw.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })
    }

    this.chainId = chainId
    this.verified.delete(chainId)
    this.buildClients()
    this.notify()
  }

  async transfer(request: TransferRequest): Promise<TransferReceipt> {
    if (!this.walletClient || !this.publicClient || !this.chainId) {
      throw new Error('Wallet not connected')
    }
    if (!isAddress(request.to)) {
      throw new Error(
        `${request.toLabel} has not linked a wallet address, so there is nowhere to send this.`,
      )
    }

    const account = this.accounts[0]
    const to = getAddress(request.to)
    const chain = chainById(this.chainId)
    const nativeSymbol = chain?.nativeCurrency.symbol ?? 'ETH'

    let hash: `0x${string}`

    if (request.asset === nativeSymbol) {
      hash = await this.walletClient.sendTransaction({
        account,
        chain: chain ?? null,
        to,
        value: parseUnits(String(request.amount), chain?.nativeCurrency.decimals ?? 18),
      })
    } else {
      const token = (await this.verifyTokens(this.chainId)).find(
        (t) => t.symbol === request.asset,
      )
      if (!token) {
        throw new Error(`${request.asset} is not available on ${chain?.name ?? 'this network'}`)
      }
      hash = await this.walletClient.writeContract({
        account,
        chain: chain ?? null,
        address: token.address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, parseUnits(String(request.amount), token.decimals)],
      })
    }

    // Wait for inclusion, so a receipt is only produced by a mined transaction.
    const mined = await this.publicClient.waitForTransactionReceipt({ hash })
    if (mined.status === 'reverted') {
      throw new Error('The transaction was mined but reverted')
    }

    const receipt: TransferReceipt = {
      id: uid('rcpt'),
      createdAt: new Date().toISOString(),
      amount: request.amount,
      asset: request.asset,
      direction: 'out',
      counterparty: request.toLabel,
      memo: request.memo,
      settlement: {
        kind: 'onchain',
        hash,
        chainId: this.chainId,
        explorerUrl: explorerTxUrl(this.chainId, hash),
      },
    }
    this.history.unshift(receipt)
    return receipt
  }

  /** Transfers made through MESH this session. Full history needs an indexer. */
  async getHistory(): Promise<TransferReceipt[]> {
    return this.history.map((r) => ({ ...r }))
  }
}

interface TokenConfigChecked {
  symbol: string
  name: string
  address: Address
  decimals: number
}

export const evmProvider = new EvmProvider()
