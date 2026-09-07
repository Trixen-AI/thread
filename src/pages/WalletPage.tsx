import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Gem,
  Globe,
  LogOut,
  Plus,
  RefreshCw,
  Star,
  Wallet as WalletIcon,
} from 'lucide-react'
import { cn, compact, shortAddress, tokenAmount, timeAgo, usd } from '@/lib/utils'
import type { TransferReceipt } from '@/types'
import { selectCurrentUser, selectMyCommunities, setUi, useApp } from '@/store/appStore'
import {
  disconnectWallet,
  refreshBalances,
  switchAccount,
  toast,
  unlinkWallet,
  verifyOwnership,
} from '@/store/actions'
import { IdentityService, WalletService, isTestnet } from '@/services/blockchain'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, DemoBadge } from '@/components/ui/Badge'
import { SegmentedTabs } from '@/components/ui/Tabs'
import { EmptyState, ErrorState, RowSkeleton, Spinner } from '@/components/ui/Feedback'
import { Menu, MenuDivider, MenuItem } from '@/components/ui/Menu'
import { Scene } from '@/components/social/Scene'
import { TokenIcon } from '@/features/wallet/TokenIcon'
import { ConnectWalletButton } from '@/features/wallet/ConnectWalletModal'

export function WalletPage() {
  const state = useApp()
  const me = selectCurrentUser(state)
  const [tab, setTab] = useState<'tokens' | 'nfts'>('tokens')
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<TransferReceipt[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const { wallet } = state
  const connected = wallet.status === 'connected'
  const total = WalletService.totalValue(wallet.balances)
  const change = WalletService.totalChange(wallet.balances)
  const communities = selectMyCommunities(state)
  const headline = [...wallet.balances].sort((a, b) => b.amount - a.amount)[0]
  // "Linked" means the server verified a signature from this exact address,
  // not merely that some wallet is connected.
  const linked =
    !!me.walletAddress &&
    me.walletAddress.toLowerCase() === wallet.account?.address.toLowerCase()
  const onTestnet = wallet.account?.chainId ? isTestnet(wallet.account.chainId) : false
  // The identity card reads from the service rather than assembling itself,
  // so a real provider changes what it shows without touching this screen.
  const identity = IdentityService.forUser(me, wallet.account, state.ownershipVerified)

  useEffect(() => {
    if (connected) void WalletService.history().then(setHistory)
  }, [connected, wallet.balances])

  const copyAddress = async () => {
    if (!wallet.account) return
    try {
      await navigator.clipboard.writeText(wallet.account.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast({ title: 'Could not copy address', tone: 'error', icon: 'alert' })
    }
  }

  return (
    <>
      <MobileTopBar title="Wallet" showLogo={false} />
      <AppShell rail={null}>
        <div className="space-y-3 px-3 py-3 lg:px-0 lg:py-0">
          <div className="hidden items-center justify-between lg:flex">
            <div>
              <h1 className="text-[28px] font-bold tracking-[-0.032em] text-ink-900">Wallet</h1>
              <p className="mt-0.5 text-[13.5px] text-ink-500">
                Your assets and onchain identity on MESH.
              </p>
            </div>
            {wallet.isDemo && <DemoBadge />}
          </div>

          {wallet.status === 'connecting' ? (
            <Card className="p-3">
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </Card>
          ) : wallet.status === 'error' ? (
            <Card>
              <ErrorState
                title="Could not connect"
                description={wallet.error}
                action={
                  <ConnectWalletButton />
                }
              />
            </Card>
          ) : !connected ? (
            <Card>
              <EmptyState
                icon={<WalletIcon className="size-6" />}
                title="No wallet connected"
                description="Connecting a wallet adds ownership to your MESH profile — collectibles, memberships and payments."
                action={
                  <ConnectWalletButton />
                }
              />
            </Card>
          ) : (
            <>
              {/* Identity */}
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar seed={me.avatar} size="xl" name={me.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold uppercase tracking-wider text-brand-600">
                      MESH Identity
                    </p>
                    <p className="text-[19px] font-bold tracking-[-0.028em] text-ink-900">
                      @{identity.handle}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="font-mono text-[12.5px] text-ink-600">
                        {revealed ? identity.address : shortAddress(identity.address ?? '')}
                      </span>
                      <IconButton
                        label={revealed ? 'Hide full address' : 'Show full address'}
                        size="sm"
                        onClick={() => setRevealed((v) => !v)}
                      >
                        {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </IconButton>
                      <IconButton label="Copy address" size="sm" onClick={() => void copyAddress()}>
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </IconButton>
                    </div>
                  </div>

                  <Menu
                    trigger={({ toggle }) => (
                      <Button size="sm" variant="secondary" onClick={toggle} iconRight={<ChevronDown className="size-4" />}>
                        {wallet.account!.label}
                      </Button>
                    )}
                  >
                    {(close) => (
                      <>
                        {wallet.accounts.map((account) => (
                          <MenuItem
                            key={account.address}
                            icon={<WalletIcon className="size-4" />}
                            hint={shortAddress(account.address)}
                            onClick={() => {
                              close()
                              void switchAccount(account.address)
                            }}
                          >
                            {account.label}
                          </MenuItem>
                        ))}
                        <MenuDivider />
                        <MenuItem
                          icon={<BadgeCheck className="size-4" />}
                          onClick={() => {
                            close()
                            void verifyOwnership()
                          }}
                        >
                          Verify ownership
                        </MenuItem>
                        <MenuItem
                          icon={<LogOut className="size-4" />}
                          danger
                          onClick={() => {
                            close()
                            void disconnectWallet()
                          }}
                        >
                          Disconnect
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                </div>

                <div className="mt-3.5 grid grid-cols-3 gap-2 hairline-t pt-3.5">
                  <IdentityStat
                    icon={<Star className="size-4 text-amber-500" />}
                    value={compact(me.reputation)}
                    label="Reputation"
                  />
                  <IdentityStat
                    icon={<Gem className="size-4 text-violet-500" />}
                    value={String(state.collectibles.length)}
                    label="Collectibles"
                  />
                  <IdentityStat
                    icon={<BadgeCheck className="size-4 text-brand-500" />}
                    value={String(communities.length)}
                    label="Memberships"
                  />
                </div>

                {!wallet.isDemo && (
                  <button
                    onClick={() => setUi({ walletSheet: 'network' })}
                    className="panel mt-3 flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-ink-700/[0.05]"
                  >
                    <Globe className="size-4 shrink-0 text-ink-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-ink-900">
                        {wallet.account!.chainName}
                      </span>
                      <span className="block text-[12px] text-ink-500">Tap to switch network</span>
                    </span>
                    {onTestnet && <Badge tone="warn">Testnet</Badge>}
                  </button>
                )}

                <div
                  className={cn(
                    'mt-2 flex items-start gap-2.5 rounded-[16px] px-3.5 py-2.5 text-[12.5px] leading-snug',
                    linked ? 'bg-success/14 text-emerald-800' : 'bg-ink-700/8 text-ink-600',
                  )}
                >
                  <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                  <p className="flex-1">
                    {linked
                      ? 'This address is verified and linked to your profile. Other people can tip it.'
                      : wallet.isDemo
                        ? 'The demo wallet holds no keys, so it cannot sign a proof of ownership.'
                        : 'Sign a message to link this address to your profile. Until you do, nobody can tip you.'}
                  </p>
                  {!wallet.isDemo &&
                    (linked ? (
                      <Button size="xs" variant="secondary" onClick={() => void unlinkWallet()}>
                        Unlink
                      </Button>
                    ) : (
                      <Button size="xs" onClick={() => void verifyOwnership()}>
                        Verify
                      </Button>
                    ))}
                </div>
              </Card>

              {/* Balance */}
              <Card className="relative overflow-hidden">
                {/* A tint that leans warm or cool with the day's direction. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-70"
                  style={{
                    background:
                      (change ?? 0) >= 0
                        ? 'radial-gradient(24rem 12rem at 88% -20%, rgb(52 199 89 / 0.14), transparent 70%), radial-gradient(20rem 12rem at 4% 110%, rgb(88 86 214 / 0.12), transparent 70%)'
                        : 'radial-gradient(24rem 12rem at 88% -20%, rgb(255 59 48 / 0.12), transparent 70%)',
                  }}
                />
                <div className="relative p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink-500">
                        {total !== null ? 'Total Balance' : 'Balance'}
                      </p>
                      {/*
                        With no price feed there is no dollar total to show, so
                        the headline is the largest holding in its own units.
                        Inventing a USD figure here would be a lie about money.
                      */}
                      <p className="mt-0.5 truncate text-[34px] font-bold leading-none tracking-[-0.035em] text-ink-900">
                        {total !== null
                          ? usd(total)
                          : headline
                            ? `${tokenAmount(headline.amount, headline.symbol)} ${headline.symbol}`
                            : '—'}
                      </p>
                      {change !== null ? (
                        <p
                          className={cn(
                            'mt-1.5 text-[13px] font-semibold',
                            change >= 0 ? 'text-success' : 'text-danger',
                          )}
                        >
                          {change >= 0 ? '+' : ''}
                          {change.toFixed(1)}% today
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[12.5px] text-ink-500">
                          No price feed configured
                        </p>
                      )}
                    </div>
                    <IconButton
                      label="Refresh balances"
                      size="sm"
                      onClick={async () => {
                        setRefreshing(true)
                        await refreshBalances()
                        setRefreshing(false)
                      }}
                    >
                      {refreshing ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
                    </IconButton>
                  </div>

                  <Sparkline change={change ?? 0} className="mt-3" />

                  <div className="mt-4 grid grid-cols-4 gap-2">
                    <WalletAction
                      icon={<ArrowUpRight className="size-[19px]" />}
                      label="Send"
                      onClick={() => setUi({ walletSheet: 'send' })}
                    />
                    <WalletAction
                      icon={<ArrowDownToLine className="size-[19px]" />}
                      label="Receive"
                      onClick={() => setUi({ walletSheet: 'receive' })}
                    />
                    <WalletAction
                      icon={<Plus className="size-[19px]" />}
                      label="Buy"
                      onClick={() => setUi({ walletSheet: 'buy' })}
                    />
                    <WalletAction
                      icon={<ArrowLeftRight className="size-[19px]" />}
                      label="Swap"
                      onClick={() => setUi({ walletSheet: 'swap' })}
                    />
                  </div>
                </div>
              </Card>

              {/* Holdings */}
              <Card className="p-3">
                <SegmentedTabs
                  items={[
                    { id: 'tokens' as const, label: 'Tokens' },
                    { id: 'nfts' as const, label: 'NFTs' },
                  ]}
                  value={tab}
                  onChange={setTab}
                />

                {tab === 'tokens' ? (
                  <ul className="mt-2">
                    {wallet.balances.map((balance) => (
                      <li
                        key={balance.symbol}
                        className="flex items-center gap-3 rounded-xl px-1.5 py-2.5 transition-colors hover:bg-ink-700/[0.05]"
                      >
                        <TokenIcon symbol={balance.symbol} size="lg" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14.5px] font-bold text-ink-900">{balance.symbol}</p>
                          <p className="text-[12.5px] text-ink-500">
                            {balance.usdPrice != null
                              ? usd(balance.amount * balance.usdPrice)
                              : balance.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[14.5px] font-bold text-ink-900">
                            {tokenAmount(balance.amount, balance.symbol)}
                          </p>
                          {balance.change24h != null && (
                            <p
                              className={cn(
                                'text-[12.5px] font-semibold',
                                balance.change24h > 0
                                  ? 'text-success'
                                  : balance.change24h < 0
                                    ? 'text-danger'
                                    : 'text-ink-400',
                              )}
                            >
                              {balance.change24h > 0 ? '+' : ''}
                              {balance.change24h.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {state.collectibles.map((item) => (
                      <div
                        key={item.id}
                        className="overflow-hidden panel"
                      >
                        <Scene
                          kind={item.scene}
                          tone={item.tone}
                          rounded="rounded-none"
                          className="aspect-square"
                        />
                        <div className="p-2.5">
                          <p className="truncate text-[13px] font-bold text-ink-900">{item.name}</p>
                          <p className="truncate text-[11.5px] text-ink-500">{item.collection}</p>
                          {item.floor && (
                            <Badge tone="neutral" className="mt-1.5">
                              Floor {tokenAmount(item.floor, item.floorAsset ?? 'ETH')}{' '}
                              {item.floorAsset}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Activity */}
              <Card className="p-3">
                <h2 className="px-1.5 pb-1 text-[15px] font-bold text-ink-900">Activity</h2>
                {history.length === 0 ? (
                  <EmptyState
                    icon={<ArrowLeftRight className="size-6" />}
                    title="No activity yet"
                    description="Tips, collects and transfers from this session show up here."
                  />
                ) : (
                  <ul>
                    {history.map((receipt) => (
                      <li
                        key={receipt.id}
                        className="flex items-center gap-3 rounded-xl px-1.5 py-2.5"
                      >
                        <span className="flex size-9 items-center justify-center rounded-full bg-ink-700/8 text-ink-500">
                          <ArrowUpRight className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-ink-900">
                            {receipt.memo ?? 'Transfer'} · {receipt.counterparty}
                          </p>
                          <p className="text-[12px] text-ink-500">
                            {timeAgo(receipt.createdAt)} ·{' '}
                            {receipt.settlement.kind === 'demo' ? 'demo' : 'onchain'}
                          </p>
                        </div>
                        <p className="shrink-0 text-[14px] font-bold text-ink-900">
                          −{tokenAmount(receipt.amount, receipt.asset)} {receipt.asset}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {wallet.isDemo && (
                <p className="px-1 pb-4 text-[12px] leading-relaxed text-ink-500">
                  MESH is running on its local demo provider. Balances live in memory, reset on
                  reload, and no transaction is broadcast to any blockchain. Registering a real
                  provider in <code className="font-mono">services/blockchain</code> switches every
                  screen above to live data.
                </p>
              )}
            </>
          )}
        </div>
      </AppShell>
    </>
  )
}

function IdentityStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="panel-inset px-2 py-2.5 text-center">
      <span className="flex justify-center">{icon}</span>
      <p className="mt-1 text-[16px] font-bold tracking-[-0.02em] text-ink-900">{value}</p>
      <p className="text-[11.5px] text-ink-500">{label}</p>
    </div>
  )
}

function WalletAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 rounded-[12px] py-1 transition-transform duration-200 [transition-timing-function:var(--ease-tap)] active:scale-90"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-600/12 text-brand-600 shadow-[inset_0_0.5px_0_rgb(255_255_255/0.6)] transition-colors duration-200 group-hover:bg-brand-600/20">
        {icon}
      </span>
      <span className="text-[12px] font-semibold tracking-[-0.01em] text-ink-700">{label}</span>
    </button>
  )
}

/** Decorative portfolio trend line. Shape follows the 24h change, not a price feed. */
function Sparkline({ change, className }: { change: number; className?: string }) {
  const up = change >= 0
  const points = up
    ? '0,34 18,30 36,32 54,22 72,26 90,14 108,18 126,8 144,10 162,2'
    : '0,4 18,8 36,6 54,16 72,12 90,22 108,20 126,28 144,26 162,34'
  const stroke = up ? 'var(--color-success)' : 'var(--color-danger)'

  return (
    <svg
      viewBox="0 0 162 40"
      preserveAspectRatio="none"
      className={cn('h-12 w-full', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`${points} 162,40 0,40`} fill="url(#sparkFill)" stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
