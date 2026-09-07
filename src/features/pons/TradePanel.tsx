import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDown, ExternalLink, Wallet as WalletIcon } from 'lucide-react'
import { formatUnits, type Address } from 'viem'
import { cn } from '@/lib/utils'
import { useApp } from '@/store/appStore'
import { buyOnCurve, sellOnCurve, selectPonsReady, switchNetwork } from '@/store/actions'
import {
  PONS_CHAIN,
  PONS_CHAIN_ID,
  computeSell,
  quoteBuy,
  readQuoteBalance,
  readTokenBalance,
  withSlippage,
  type BuyQuote,
  type LaunchView,
  type TradePhase,
} from '@/services/pons'
import { Button } from '@/components/ui/Button'
import { SegmentedTabs } from '@/components/ui/Tabs'
import { ConnectWalletButton } from '@/features/wallet/ConnectWallet'
import { fmtBps, fmtPrice, fmtUnits, parseAmount } from './format'

type Side = 'buy' | 'sell'

const SLIPPAGE_PRESETS = [50, 100, 300]

const PHASE_LABEL: Record<TradePhase, string> = {
  // A sell needs the curve approved to pull the launch token, and a custom-pair
  // buy needs it approved to pull the quote asset. Either way this step comes
  // first, and it is its own wallet prompt.
  approving: 'Approve in wallet…',
  confirm: 'Confirm in wallet…',
  pending: 'Waiting for the chain…',
}

/**
 * Buy and sell against the curve.
 *
 * The quote is computed from the curve's reserves with the contract's own
 * arithmetic, and refreshed with every keystroke and every reload of the
 * launch, so what is shown is what the trade settles at when nothing moves.
 * The slippage limit is enforced by the contract, not here.
 */
export function TradePanel({ launch, onTraded }: { launch: LaunchView; onTraded: () => void }) {
  const state = useApp()
  const ready = selectPonsReady(state)
  const account = state.wallet.account?.address as Address | undefined
  const connected = state.wallet.status === 'connected' && !state.wallet.isDemo

  const [side, setSide] = useState<Side>('buy')
  const [input, setInput] = useState('')
  const [slippageBps, setSlippageBps] = useState(100)
  const [buyQuote, setBuyQuote] = useState<BuyQuote | null>(null)
  const [phase, setPhase] = useState<TradePhase | null>(null)
  const [balances, setBalances] = useState<{ quote: bigint; token: bigint } | null>(null)

  const curve = launch.state
  const rates = useMemo(
    () => ({ feeBps: BigInt(launch.feeBps), creatorTaxBps: BigInt(launch.creatorTaxBps) }),
    [launch.feeBps, launch.creatorTaxBps],
  )
  const inDecimals = side === 'buy' ? launch.quote.decimals : launch.decimals
  const amount = parseAmount(input, inDecimals)

  const buysOpen = launch.phase === 'trading' && curve.sellableTokens > 0n
  // Sells close as soon as the curve is holding the pool's reserves, before graduation has run.
  const sellsOpen = launch.phase === 'trading' && !curve.readyToGraduate

  // Balances for the connected account, refreshed with the launch.
  useEffect(() => {
    if (!account || !ready) {
      setBalances(null)
      return
    }
    let cancelled = false
    void Promise.all([readQuoteBalance(launch.quote, account), readTokenBalance(launch.token, account)]).then(
      ([quote, token]) => {
        if (!cancelled) setBalances({ quote, token })
      },
    )
    return () => {
      cancelled = true
    }
  }, [account, ready, launch.quote, launch.token, launch.readAt])

  // The buy quote needs the recipient's snipe-tax reading, so it is a chain read
  // rather than pure arithmetic. Debounced so typing does not flood the RPC.
  useEffect(() => {
    if (side !== 'buy' || !amount) {
      setBuyQuote(null)
      return
    }
    let cancelled = false
    const recipient = account ?? ('0x0000000000000000000000000000000000000001' as Address)
    const t = setTimeout(() => {
      void quoteBuy(launch.curve, amount, recipient, rates).then((q) => {
        if (!cancelled) setBuyQuote(q)
      })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [side, amount, account, launch.curve, rates, launch.readAt])

  // Sells price from the reserves already loaded with the launch — no tax, no read.
  const sellQuote = useMemo(() => {
    if (side !== 'sell' || !amount) return null
    return computeSell({
      tokensIn: amount,
      quoteReserve: curve.quoteReserve,
      tokenReserve: curve.tokenReserve,
      ...rates,
    })
  }, [side, amount, curve.quoteReserve, curve.tokenReserve, rates])

  const out = side === 'buy' ? buyQuote?.tokensOut : sellQuote?.quoteOut
  const outDecimals = side === 'buy' ? launch.decimals : launch.quote.decimals
  const outSymbol = side === 'buy' ? launch.symbol : launch.quote.symbol
  const inSymbol = side === 'buy' ? launch.quote.symbol : launch.symbol

  const averagePrice = useMemo(() => {
    if (!amount || !out || out === 0n) return null
    if (side === 'buy') {
      const spent = buyQuote?.spent ?? amount
      return Number(formatUnits(spent, launch.quote.decimals)) / Number(formatUnits(out, launch.decimals))
    }
    return Number(formatUnits(out, launch.quote.decimals)) / Number(formatUnits(amount, launch.decimals))
  }, [amount, out, side, buyQuote, launch.decimals, launch.quote.decimals])

  const impact = averagePrice && curve.price ? averagePrice / curve.price - 1 : null

  const insufficient =
    !!balances && !!amount && (side === 'buy' ? amount > balances.quote : amount > balances.token)

  const submit = async () => {
    if (!amount || !out || phase) return
    setPhase('confirm')
    const outcome =
      side === 'buy'
        ? await buyOnCurve(launch.curve, launch.quote, amount, withSlippage(out, slippageBps), launch.symbol, setPhase)
        : await sellOnCurve(launch.curve, launch.token, amount, withSlippage(out, slippageBps), launch.symbol, setPhase)
    setPhase(null)
    if (outcome.result) {
      setInput('')
      onTraded()
    }
  }

  const useMax = () => {
    if (!balances) return
    const max = side === 'buy' ? balances.quote : balances.token
    setInput(formatUnits(max, inDecimals))
  }

  if (launch.phase === 'graduated') {
    return (
      <div className="panel p-4">
        <p className="text-[15px] font-bold text-ink-900">Trading on Uniswap v4</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
          The curve sold out and its liquidity is locked permanently in a Uniswap v4 pool on{' '}
          {PONS_CHAIN.name}. Any v4-aware router can trade it — the pool pairs ${launch.symbol} with{' '}
          {launch.quote.symbol}.
        </p>
      </div>
    )
  }

  return (
    <div className="panel p-4">
      <SegmentedTabs
        items={[
          { id: 'buy' as const, label: 'Buy' },
          { id: 'sell' as const, label: 'Sell' },
        ]}
        value={side}
        onChange={(next) => {
          setSide(next)
          setInput('')
        }}
      />

      {/* Input leg */}
      <div className="mt-3 rounded-[14px] bg-ink-700/[0.05] p-3 shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.06)]">
        <div className="flex items-center justify-between text-[12px] font-semibold text-ink-500">
          <span>You pay</span>
          {balances && (
            <button onClick={useMax} className="text-brand-600 hover:text-brand-700">
              Balance {fmtUnits(side === 'buy' ? balances.quote : balances.token, inDecimals)} · Max
            </button>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <input
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0"
            disabled={!!phase}
            className="min-w-0 flex-1 bg-transparent text-[26px] font-bold tracking-[-0.02em] text-ink-900 placeholder:text-ink-300 focus:outline-none"
          />
          <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-ink-800 shadow-[var(--shadow-card)]">
            {inSymbol}
          </span>
        </div>
      </div>

      <div className="-my-1.5 flex justify-center">
        <span className="z-10 flex size-8 items-center justify-center rounded-full bg-white text-ink-500 shadow-[var(--shadow-card)]">
          <ArrowDown className="size-4" />
        </span>
      </div>

      {/* Output leg */}
      <div className="rounded-[14px] bg-ink-700/[0.05] p-3 shadow-[inset_0_0_0_0.5px_rgb(16_16_24/0.06)]">
        <div className="text-[12px] font-semibold text-ink-500">You receive</div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[26px] font-bold tracking-[-0.02em]',
              out ? 'text-ink-900' : 'text-ink-300',
            )}
          >
            {out ? fmtUnits(out, outDecimals) : '0'}
          </span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-ink-800 shadow-[var(--shadow-card)]">
            {outSymbol}
          </span>
        </div>
      </div>

      {/* Terms of this trade */}
      <dl className="mt-3 space-y-1 text-[12.5px]">
        <Row label="Spot price" value={fmtPrice(curve.price, `${launch.quote.symbol} / ${launch.symbol}`)} />
        {averagePrice !== null && (
          <Row label="Average price" value={fmtPrice(averagePrice, `${launch.quote.symbol} / ${launch.symbol}`)} />
        )}
        {impact !== null && (
          <Row
            label="Price impact"
            value={`${impact >= 0 ? '+' : ''}${(impact * 100).toFixed(2)}%`}
            tone={Math.abs(impact) > 0.1 ? 'warn' : undefined}
          />
        )}
        <Row
          label="Trade fee"
          value={`${fmtBps(launch.feeBps)}${launch.creatorTaxBps ? ` + ${fmtBps(launch.creatorTaxBps)} creator tax` : ''}`}
        />
        {side === 'buy' && buyQuote && buyQuote.snipeTaxBps > 0n && (
          <Row label="Snipe tax right now" value={fmtBps(buyQuote.snipeTaxBps)} tone="warn" />
        )}
        {side === 'buy' && buyQuote?.clamped && (
          <Row
            label="Refund"
            value={`${fmtUnits(buyQuote.refund, launch.quote.decimals)} ${launch.quote.symbol}`}
            hint="This buy finishes the curve — only what fills is charged."
          />
        )}
        <div className="flex items-center justify-between pt-1">
          <dt className="text-ink-500">Slippage</dt>
          <dd className="flex gap-1">
            {SLIPPAGE_PRESETS.map((bps) => (
              <button
                key={bps}
                onClick={() => setSlippageBps(bps)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11.5px] font-semibold transition-colors',
                  slippageBps === bps ? 'bg-brand-600 text-white' : 'bg-ink-700/8 text-ink-600 hover:bg-ink-700/12',
                )}
              >
                {fmtBps(bps)}
              </button>
            ))}
          </dd>
        </div>
      </dl>

      {side === 'buy' && buyQuote && buyQuote.snipeTaxBps > 0n && (
        <Notice tone="warn">
          This launch is in its opening seconds. The snipe tax is {fmtBps(buyQuote.snipeTaxBps)} of your buy
          right now and decays to zero within five seconds — waiting a moment is cheaper.
        </Notice>
      )}
      {side === 'buy' && !buysOpen && launch.phase === 'trading' && (
        <Notice tone="neutral">The curve has sold out. It graduates inside the next transaction that finishes it.</Notice>
      )}
      {side === 'sell' && !sellsOpen && launch.phase === 'trading' && (
        <Notice tone="neutral">
          Selling closes once the curve is ready to graduate, because it is holding the pool's reserves. It
          reopens in the Uniswap v4 pool.
        </Notice>
      )}
      {launch.phase === 'swept' && (
        <Notice tone="neutral">The curve closed and the pool has not been created yet. Trading resumes on Uniswap v4 once it is.</Notice>
      )}

      {/* The one action, gated on what is actually true about the wallet. */}
      <div className="mt-3">
        {!connected ? (
          <ConnectWalletButton block />
        ) : !ready ? (
          <Button block size="lg" icon={<WalletIcon className="size-[18px]" />} onClick={() => void switchNetwork(PONS_CHAIN_ID)}>
            Switch to {PONS_CHAIN.name}
          </Button>
        ) : (
          <Button
            block
            size="lg"
            loading={!!phase}
            disabled={!amount || !out || insufficient || (side === 'buy' ? !buysOpen : !sellsOpen)}
            onClick={() => void submit()}
          >
            {phase
              ? PHASE_LABEL[phase]
              : insufficient
                ? `Not enough ${inSymbol}`
                : side === 'buy'
                  ? `Buy $${launch.symbol}`
                  : `Sell $${launch.symbol}`}
          </Button>
        )}
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-500">
        <AlertTriangle className="mt-0.5 size-3 shrink-0" />
        <span>
          Your wallet submits the transaction and it may be irreversible. Always check the token address —{' '}
          <a
            href={`https://robinhoodchain.blockscout.com/address/${launch.token}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 font-semibold text-brand-600 hover:underline"
          >
            view on Blockscout <ExternalLink className="size-3" />
          </a>
        </span>
      </p>
    </div>
  )
}

function Row({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-500">
        {label}
        {hint && <span className="block text-[11.5px] text-ink-400">{hint}</span>}
      </dt>
      <dd className={cn('text-right font-semibold tabular-nums', tone === 'warn' ? 'text-amber-700' : 'text-ink-800')}>
        {value}
      </dd>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'warn' | 'neutral'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'mt-3 rounded-[12px] px-3 py-2.5 text-[12.5px] leading-snug',
        tone === 'warn' ? 'bg-warn/12 text-amber-800' : 'bg-ink-700/[0.06] text-ink-600',
      )}
    >
      {children}
    </p>
  )
}
