import type { Collectible, TokenBalance, TransferReceipt, WalletAccount } from '@/types'
import { sleep, uid } from '@/lib/utils'
import { DEMO_ACCOUNTS, DEMO_BALANCES, seedCollectibles } from '@/data/seed'
import type { ChainProvider, OwnershipProof, TransferRequest } from './provider'

/**
 * A local, in-memory provider used while no wallet or chain is configured.
 *
 * Deliberate limits, so nothing here can be mistaken for a real chain:
 *   • it never produces a transaction hash — receipts settle as `{ kind: 'demo' }`
 *   • it cannot sign, so `proveOwnership` returns `verified: false`
 *   • balances live in memory and reset on reload
 *
 * `isDemo` is true, and the UI surfaces that wherever value moves.
 */
class DemoProvider implements ChainProvider {
  readonly id = 'demo'
  readonly label = 'MESH demo wallet'
  readonly isDemo = true

  private connected = false
  private balances: TokenBalance[] = DEMO_BALANCES.map((b) => ({ ...b }))
  private history: TransferReceipt[] = []

  async connect(): Promise<WalletAccount[]> {
    await sleep(750) // stand-in for the wallet approval round-trip
    this.connected = true
    return DEMO_ACCOUNTS
  }

  async disconnect(): Promise<void> {
    await sleep(120)
    this.connected = false
  }

  async getAccounts(): Promise<WalletAccount[]> {
    return this.connected ? DEMO_ACCOUNTS : []
  }

  async getBalances(): Promise<TokenBalance[]> {
    await sleep(180)
    return this.balances.map((b) => ({ ...b }))
  }

  async getCollectibles(): Promise<Collectible[]> {
    await sleep(180)
    return seedCollectibles.map((c) => ({ ...c }))
  }

  async proveOwnership(address: string, statement: string): Promise<OwnershipProof> {
    await sleep(500)
    return {
      address,
      statement,
      issuedAt: new Date().toISOString(),
      signature: null,
      // No key material exists here, so this claim is explicitly unverified.
      verified: false,
    }
  }

  async transfer(request: TransferRequest): Promise<TransferReceipt> {
    await sleep(900)

    const balance = this.balances.find((b) => b.symbol === request.asset)
    if (!balance) throw new Error(`Unknown asset ${request.asset}`)
    if (request.amount <= 0) throw new Error('Amount must be greater than zero')
    if (balance.amount < request.amount) {
      throw new Error(`Not enough ${request.asset} in this demo wallet`)
    }

    balance.amount = Number((balance.amount - request.amount).toFixed(6))

    const receipt: TransferReceipt = {
      id: uid('rcpt'),
      createdAt: new Date().toISOString(),
      amount: request.amount,
      asset: request.asset,
      direction: 'out',
      counterparty: request.toLabel,
      memo: request.memo,
      settlement: { kind: 'demo', reference: uid('demo') },
    }
    this.history.unshift(receipt)
    return receipt
  }

  async getHistory(): Promise<TransferReceipt[]> {
    return this.history.map((r) => ({ ...r }))
  }

  /** Demo-only: credit the wallet, e.g. from the Receive/Buy sheets. */
  credit(symbol: TokenBalance['symbol'], amount: number) {
    const balance = this.balances.find((b) => b.symbol === symbol)
    if (balance) balance.amount = Number((balance.amount + amount).toFixed(6))
  }
}

export const demoProvider = new DemoProvider()
