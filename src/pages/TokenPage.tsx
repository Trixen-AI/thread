import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ExternalLink, Globe, MessageSquareText, RefreshCw, Send } from 'lucide-react'
import { isAddress, type Address } from 'viem'
import { shortAddress } from '@/lib/utils'
import type { TokenAttachment } from '@/types'
import { useApp } from '@/store/appStore'
import { openTokenThreadComposer, refreshFeed, selectTokenPosts } from '@/store/actions'
import { PONS_CHAIN_ID, phaseDetail, readLaunch, readTokenBalance, type LaunchView } from '@/services/pons'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/Feedback'
import { PostCard } from '@/features/feed/PostCard'
import { AddressChip, CurveProgress, PhaseBadge, TokenLogo } from '@/features/pons/TokenBits'
import { TradePanel } from '@/features/pons/TradePanel'
import { fmtBps, fmtCompactUnits, fmtPrice, fmtUnits } from '@/features/pons/format'

/** How often a live curve is re-read. Blocks land every tenth of a second; people do not. */
const POLL_MS = 12_000

/**
 * One token: what it is, where its curve stands, a place to trade it, and the
 * thread about it on MESH. Every number on this page is read from the chain
 * when the page opens and re-read while the launch is live.
 */
export function TokenPage() {
  const { address } = useParams<{ address: string }>()
  const navigate = useNavigate()
  const state = useApp()
  const account = state.wallet.account?.address as Address | undefined

  const [launch, setLaunch] = useState<LaunchView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [holding, setHolding] = useState<bigint | null>(null)

  const valid = !!address && isAddress(address)

  const load = useCallback(async () => {
    if (!valid) return
    setRefreshing(true)
    try {
      setLaunch(await readLaunch(address as Address))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this launch')
    } finally {
      setRefreshing(false)
    }
  }, [address, valid])

  useEffect(() => {
    void load()
    void refreshFeed()
  }, [load])

  // Keep a live curve fresh without hammering the RPC.
  useEffect(() => {
    if (!launch || launch.phase !== 'trading') return
    const t = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(t)
  }, [launch, load])

  useEffect(() => {
    if (!launch || !account || state.wallet.account?.chainId !== PONS_CHAIN_ID) {
      setHolding(null)
      return
    }
    void readTokenBalance(launch.token, account).then(setHolding)
  }, [launch, account, state.wallet.account?.chainId])

  const posts = launch ? selectTokenPosts(state, launch.token) : []

  const attachment: TokenAttachment | null = launch
    ? {
        chainId: PONS_CHAIN_ID,
        address: launch.token,
        curve: launch.curve,
        name: launch.name,
        symbol: launch.symbol,
        quoteSymbol: launch.quote.symbol,
        logo: launch.logo || undefined,
      }
    : null

  const title = launch ? `${launch.name} · $${launch.symbol}` : 'Token'

  return (
    <>
      <MobileTopBar title={title} showLogo={false} />
      <AppShell wide rail={null}>
        <PageHeader
          title={title}
          subtitle={launch ? `${phaseDetail[launch.phase]}` : valid ? shortAddress(address!, 6, 4) : 'Not an address'}
          onBack={() => navigate(-1)}
          className="lg:rounded-[16px]"
          action={
            <IconButton label="Refresh" variant="glass" onClick={() => void load()} disabled={refreshing || !valid}>
              <RefreshCw className={refreshing ? 'size-4 animate-[var(--animate-spin-slow)]' : 'size-4'} />
            </IconButton>
          }
        />

        <div className="px-3 py-4 lg:px-0">
          {!valid ? (
            <ErrorState title="That is not a token address" description="A pons token is identified by its contract address on Robinhood Chain." />
          ) : error && !launch ? (
            <ErrorState title="Could not read this launch" description={error} action={<Button onClick={() => void load()}>Try again</Button>} />
          ) : !launch ? (
            <div className="panel flex items-center gap-3 p-5 text-[13.5px] text-ink-500">
              <Spinner className="size-4" />
              Reading the factory and the curve…
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              {/* ------------------------------ Left ------------------------------ */}
              <div className="space-y-4">
                <section className="panel p-4">
                  <div className="flex items-start gap-4">
                    <TokenLogo logo={launch.logo} symbol={launch.symbol} address={launch.token} size="xl" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-[24px] font-bold tracking-[-0.03em] text-ink-900">{launch.name}</h1>
                        <span className="text-[15px] font-semibold text-ink-500">${launch.symbol}</span>
                        <PhaseBadge phase={launch.phase} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <AddressChip address={launch.token} label="Token" />
                        <AddressChip address={launch.curve} label="Curve" />
                      </div>
                      <p className="mt-2 text-[12.5px] text-ink-500">
                        Created by <span className="font-mono text-ink-700">{shortAddress(launch.deployer, 6, 4)}</span> · fees to{' '}
                        <span className="font-mono text-ink-700">{shortAddress(launch.creatorFeeRecipient, 6, 4)}</span>
                      </p>
                    </div>
                  </div>

                  {launch.description && (
                    <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.5] tracking-[-0.011em] text-ink-800">{launch.description}</p>
                  )}

                  <Socials socials={launch.socials} />
                </section>

                <section className="panel space-y-3 p-4">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-[16px] font-bold tracking-[-0.02em] text-ink-900">Curve</h2>
                    <span className="text-[13px] text-ink-500">
                      Spot <span className="font-bold text-ink-900">{fmtPrice(launch.state.price, launch.quote.symbol)}</span>
                    </span>
                  </div>
                  <CurveProgress
                    progress={launch.state.progress}
                    raised={launch.state.realQuoteReserve}
                    threshold={launch.state.graduationThreshold}
                    quoteSymbol={launch.quote.symbol}
                    quoteDecimals={launch.quote.decimals}
                  />
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-1 sm:grid-cols-3">
                    <Stat label="Priced in" value={launch.quote.symbol} />
                    <Stat label="Supply" value={fmtCompactUnits(launch.totalSupply, launch.decimals)} />
                    <Stat label="Still buyable" value={fmtCompactUnits(launch.state.sellableTokens, launch.decimals)} />
                    <Stat label="Held for the pool" value={fmtCompactUnits(launch.state.reservedTokens, launch.decimals)} />
                    <Stat label="Trade fee" value={fmtBps(launch.feeBps)} />
                    <Stat label="Creator tax" value={launch.creatorTaxBps ? fmtBps(launch.creatorTaxBps) : 'None'} />
                    <Stat label="Buybacks" value={launch.buybackEnabled ? 'On' : 'Off'} />
                    <Stat label="Raised" value={`${fmtUnits(launch.state.realQuoteReserve, launch.quote.decimals)} ${launch.quote.symbol}`} />
                    {holding !== null && (
                      <Stat label="You hold" value={`${fmtCompactUnits(holding, launch.decimals)} $${launch.symbol}`} accent />
                    )}
                  </dl>
                </section>

                {/* Mobile: trade before the thread. Desktop: it lives in the right column. */}
                <div className="lg:hidden">
                  <TradePanel launch={launch} onTraded={() => void load()} />
                </div>

                <section className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="flex items-center gap-2 text-[16px] font-bold tracking-[-0.02em] text-ink-900">
                      <MessageSquareText className="size-4 text-brand-600" />
                      Thread
                      {posts.length > 0 && <span className="text-[13px] font-semibold text-ink-500">{posts.length}</span>}
                    </h2>
                    {attachment && (
                      <Button size="sm" pill variant="subtle" icon={<Send className="size-3.5" />} onClick={() => openTokenThreadComposer(attachment)}>
                        Write in thread
                      </Button>
                    )}
                  </div>
                  {posts.length === 0 ? (
                    <EmptyState
                      icon={<MessageSquareText className="size-6" />}
                      title="Nothing in the thread yet"
                      description={`Be the first to write about $${launch.symbol} on MESH. Your post will carry the token so readers can open the curve.`}
                      action={
                        attachment && (
                          <Button onClick={() => openTokenThreadComposer(attachment)} icon={<Send className="size-4" />}>
                            Start the thread
                          </Button>
                        )
                      }
                      className="mesh-card"
                    />
                  ) : (
                    <div className="space-y-3">
                      {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* ------------------------------ Right ------------------------------ */}
              <div className="hidden lg:block">
                <div className="sticky top-[4.5rem] space-y-3">
                  <TradePanel launch={launch} onTraded={() => void load()} />
                  <p className="px-1 text-[11.5px] text-ink-400">
                    Read {Math.max(1, Math.round((Date.now() - launch.readAt) / 1000))}s ago · refreshes every {POLL_MS / 1000}s while live
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className={accent ? 'text-[13.5px] font-bold tabular-nums text-brand-700' : 'text-[13.5px] font-bold tabular-nums text-ink-900'}>
        {value}
      </dd>
    </div>
  )
}

function Socials({ socials }: { socials: LaunchView['socials'] }) {
  const links = [
    { label: 'Website', href: socials.website, icon: Globe },
    { label: 'X', href: socials.twitter, icon: ExternalLink },
    { label: 'Telegram', href: socials.telegram, icon: ExternalLink },
    { label: 'Discord', href: socials.discord, icon: ExternalLink },
    { label: 'Farcaster', href: socials.farcaster, icon: ExternalLink },
  ].filter((l) => /^https?:\/\//.test(l.href))
  if (!links.length) return null
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink-700/[0.06] px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-ink-700/10"
        >
          <l.icon className="size-3.5" />
          {l.label}
        </a>
      ))}
    </div>
  )
}
