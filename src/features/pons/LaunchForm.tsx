import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  Link2,
  MessageSquareText,
  Plus,
  Rocket,
  ShieldCheck,
  Trash2,
  Wallet as WalletIcon,
  X,
} from 'lucide-react'
import { formatUnits, isAddress, type Address } from 'viem'
import { cn, shortAddress } from '@/lib/utils'
import { selectCurrentUser, useApp } from '@/store/appStore'
import { launchAndAnnounce, selectPonsReady, switchNetwork, type LaunchOutcome, type LaunchProgress } from '@/store/actions'
import {
  MAX_SNIPE_EXEMPTIONS,
  PONS_CHAIN,
  PONS_CHAIN_ID,
  canLaunch,
  openingEconomics,
  quoteOpeningBuy,
  validateDraft,
  type LaunchConfigView,
  type LaunchDraft,
  type LaunchTerms,
  type QuoteAsset,
} from '@/services/pons'
import { Button } from '@/components/ui/Button'
import { Field, Input, Switch, Textarea } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Feedback'
import { ConnectWalletButton } from '@/features/wallet/ConnectWallet'
import { ImageUpload } from './ImageUpload'
import { TokenLogo } from './TokenBits'
import { fmtBps, fmtCompactUnits, fmtPct, fmtPrice, fmtUnits, parseAmount } from './format'

/**
 * The create form.
 *
 * Every field maps to something the contract takes — the `TokenParams` struct,
 * the launch config, the quote asset, the snipe-tax exemptions, and the
 * optional opening buy through the launch-and-buy router. Nothing is invented
 * client-side: the fee, the tax cap, the configs and the quote assets are all
 * read from the factory before the form renders, and read again immediately
 * before the transaction is sent.
 */

const PROGRESS_LABEL: Record<LaunchProgress, string> = {
  checking: 'Reading the terms…',
  approving: 'Approve the opening buy in your wallet…',
  confirm: 'Confirm the launch in your wallet…',
  pending: 'Waiting for Robinhood Chain…',
  announcing: 'Posting your thread…',
}

const SOCIAL_FIELDS = [
  { key: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/…' },
  { key: 'telegram', label: 'Telegram', placeholder: 'https://t.me/…' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/…' },
  { key: 'website', label: 'Website', placeholder: 'https://…' },
  { key: 'farcaster', label: 'Farcaster', placeholder: 'https://warpcast.com/…' },
] as const

/** The thread a launch opens with, before the creator edits it. */
export function defaultThreadText(input: {
  name: string
  symbol: string
  description: string
  quoteSymbol: string
  thresholdLabel: string
}): string {
  const lines = [`Just launched $${input.symbol || 'TOKEN'}${input.name ? ` — ${input.name}` : ''} on pons v2.`]
  if (input.description.trim()) lines.push('', input.description.trim())
  lines.push(
    '',
    `Trading on the bonding curve now, priced in ${input.quoteSymbol}. It graduates into a locked Uniswap v4 pool once the curve collects ${input.thresholdLabel}.`,
  )
  return lines.join('\n')
}

export function LaunchForm({ terms, onLaunched }: { terms: LaunchTerms; onLaunched: (outcome: LaunchOutcome) => void }) {
  const state = useApp()
  const me = selectCurrentUser(state)
  const ready = selectPonsReady(state)
  const connected = state.wallet.status === 'connected' && !state.wallet.isDemo
  const account = state.wallet.account?.address as Address | undefined

  const openConfigs = useMemo(() => terms.configs.filter((c) => c.enabled), [terms.configs])

  const [draft, setDraft] = useState<LaunchDraft>(() => ({
    name: '',
    symbol: '',
    logo: '',
    description: '',
    socials: { twitter: '', telegram: '', discord: '', website: '', farcaster: '' },
    creatorFeeRecipient: '',
    creatorTaxBps: 0,
    buybackEnabled: false,
    config: openConfigs[0] ?? terms.configs[0],
    quote: terms.quoteAssets[0],
    snipeTaxExemptions: [],
    openingBuy: 0n,
    slippageBps: 100,
  }))
  const [openingBuyInput, setOpeningBuyInput] = useState('')
  const [exemptionInput, setExemptionInput] = useState('')
  const [taxInput, setTaxInput] = useState('0')
  const [linksOpen, setLinksOpen] = useState(false)
  const [threadEnabled, setThreadEnabled] = useState(true)
  const [threadText, setThreadText] = useState('')
  const [threadTouched, setThreadTouched] = useState(false)
  const [progress, setProgress] = useState<LaunchProgress | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [gate, setGate] = useState<{ account: string; allowed: boolean } | null>(null)

  const economics = useMemo(() => openingEconomics(draft.config, draft.quote), [draft.config, draft.quote])
  const thresholdLabel = `${fmtUnits(economics.graduationThreshold, draft.quote.decimals)} ${draft.quote.symbol}`

  // The thread follows the form until the creator edits it, then it is theirs.
  useEffect(() => {
    if (threadTouched) return
    setThreadText(
      defaultThreadText({
        name: draft.name,
        symbol: draft.symbol,
        description: draft.description,
        quoteSymbol: draft.quote.symbol,
        thresholdLabel,
      }),
    )
  }, [draft.name, draft.symbol, draft.description, draft.quote.symbol, thresholdLabel, threadTouched])

  // Whether this exact wallet may launch. Asked of the contract, per address,
  // because the answer changes when the public gate closes.
  useEffect(() => {
    if (!account || !ready) {
      setGate(null)
      return
    }
    let cancelled = false
    void canLaunch(account).then((allowed) => {
      if (!cancelled) setGate({ account, allowed })
    })
    return () => {
      cancelled = true
    }
  }, [account, ready])

  const patch = (p: Partial<LaunchDraft>) => setDraft((d) => ({ ...d, ...p }))
  const patchSocial = (key: keyof LaunchDraft['socials'], value: string) =>
    setDraft((d) => ({ ...d, socials: { ...d.socials, [key]: value } }))

  const errors = useMemo(() => validateDraft(draft, terms.maxCreatorTaxBps), [draft, terms.maxCreatorTaxBps])
  const showError = (key: string) => (submitted ? errors[key] : undefined)

  const openingQuote = useMemo(() => (draft.openingBuy > 0n ? quoteOpeningBuy(draft) : null), [draft])
  const openingShare = openingQuote ? Number(openingQuote.tokensOut) / Number(draft.config.supply) : 0

  const totalValue = draft.quote.isNative ? terms.launchFee + draft.openingBuy : terms.launchFee

  const addExemption = () => {
    const value = exemptionInput.trim()
    if (!value) return
    if (!isAddress(value)) return
    if (draft.snipeTaxExemptions.some((a) => a.toLowerCase() === value.toLowerCase())) {
      setExemptionInput('')
      return
    }
    if (draft.snipeTaxExemptions.length >= MAX_SNIPE_EXEMPTIONS) return
    patch({ snipeTaxExemptions: [...draft.snipeTaxExemptions, value] })
    setExemptionInput('')
  }

  const submit = async () => {
    setSubmitted(true)
    if (Object.keys(errors).length || progress) return
    setProgress('checking')
    const outcome = await launchAndAnnounce(draft, { enabled: threadEnabled, text: threadText }, setProgress)
    setProgress(null)
    if (outcome.result) onLaunched(outcome)
  }

  const blocked = gate && !gate.allowed

  return (
    <div className="space-y-4">
      {/* ------------------------------ Identity ------------------------------ */}
      <Section title="Token" description="Name, symbol and image are written to the token and cannot change.">
        <div className="flex items-start gap-4">
          <div className="shrink-0 pt-1">
            <TokenLogo logo={draft.logo} symbol={draft.symbol || '?'} address={account ?? '0x0'} size="xl" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Name" error={showError('name')}>
                <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Example Coin" maxLength={64} />
              </Field>
              <Field label="Symbol" error={showError('symbol')}>
                <Input
                  value={draft.symbol}
                  onChange={(e) => patch({ symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  placeholder="EXMPL"
                  maxLength={12}
                  leading={<span className="text-[14px] font-semibold">$</span>}
                />
              </Field>
            </div>
            <ImageUpload value={draft.logo} onChange={(logo) => patch({ logo })} error={showError('logo')} />
          </div>
        </div>
        <Field label="Description">
          <Textarea
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="What is this token, and why should anyone care?"
            rows={3}
            maxLength={1000}
          />
        </Field>

        <button
          type="button"
          onClick={() => setLinksOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-[12px] px-1 py-2 text-left text-[14px] font-semibold text-ink-800 hover:bg-ink-700/[0.04]"
        >
          <Link2 className="size-4 text-ink-500" />
          <span className="flex-1">Links</span>
          {Object.values(draft.socials).filter(Boolean).length > 0 && (
            <Badge tone="brand">{Object.values(draft.socials).filter(Boolean).length}</Badge>
          )}
          <ChevronDown className={cn('size-4 text-ink-400 transition-transform', linksOpen && 'rotate-180')} />
        </button>
        {linksOpen && (
          <div className="grid gap-3 sm:grid-cols-2 animate-[var(--animate-pop-in)]">
            {SOCIAL_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input value={draft.socials[f.key]} onChange={(e) => patchSocial(f.key, e.target.value)} placeholder={f.placeholder} />
              </Field>
            ))}
          </div>
        )}
      </Section>

      {/* ------------------------------ Economics ------------------------------ */}
      <Section
        title="Curve"
        description="Priced in the asset you choose. The pairing, the supply and the graduation target are fixed for the life of the launch."
      >
        <Field label="Priced in" hint="Buyers spend this asset, and your fees arrive in it.">
          <QuoteAssetPicker assets={terms.quoteAssets} value={draft.quote} onChange={(quote) => patch({ quote })} />
        </Field>

        {openConfigs.length > 1 && (
          <Field label="Launch configuration" error={showError('config')}>
            <select
              value={draft.config.id.toString()}
              onChange={(e) => {
                const next = openConfigs.find((c) => c.id.toString() === e.target.value)
                if (next) patch({ config: next })
              }}
              className="h-11 w-full rounded-[12px] bg-ink-700/[0.06] px-3.5 text-[15px] text-ink-900 focus:bg-white focus:outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-brand-500)]"
            >
              {openConfigs.map((c) => (
                <option key={c.id.toString()} value={c.id.toString()}>
                  Config #{c.id.toString()} · {fmtCompactUnits(c.supply, 18)} supply · {fmtBps(c.curveFeeBps)} fee
                </option>
              ))}
            </select>
          </Field>
        )}

        <ConfigSummary config={draft.config} quote={draft.quote} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Creator tax"
            hint={`Optional, up to ${fmtBps(terms.maxCreatorTaxBps)}. Charged on every trade and paid entirely to you. Fixed forever.`}
            error={showError('creatorTaxBps')}
          >
            <Input
              inputMode="decimal"
              value={taxInput}
              onChange={(e) => {
                setTaxInput(e.target.value)
                const pct = Number(e.target.value)
                patch({ creatorTaxBps: Number.isFinite(pct) ? Math.round(pct * 100) : 0 })
              }}
              trailing={<span className="text-[14px] font-semibold">%</span>}
              placeholder="0"
            />
          </Field>
          <Field
            label="Fee recipient"
            hint={draft.openingBuy > 0n ? 'Required for a launch-and-buy.' : 'Leave empty to use the launching wallet.'}
            error={showError('creatorFeeRecipient')}
          >
            <Input
              value={draft.creatorFeeRecipient}
              onChange={(e) => patch({ creatorFeeRecipient: e.target.value.trim() })}
              placeholder={account ?? '0x…'}
              className="font-mono text-[13px]"
            />
          </Field>
        </div>

        <Switch
          checked={draft.buybackEnabled}
          onChange={(buybackEnabled) => patch({ buybackEnabled })}
          label="Buybacks"
          description="A slice of your fee share buys the token back. Bought tokens vest over five years, split between you and the protocol. You can turn this off later, never up."
        />
      </Section>

      {/* -------------------------- Snipe protection -------------------------- */}
      <Section
        title="Team wallets"
        description="Every launch opens with a 99% buy tax that decays to zero in five seconds. Your wallet and the fee recipient are exempt automatically. Add other wallets that will buy at open — up to 32, fixed at creation."
        icon={<ShieldCheck className="size-4 text-success" />}
      >
        <div className="flex gap-2">
          <Input
            value={exemptionInput}
            onChange={(e) => setExemptionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addExemption()
              }
            }}
            placeholder="0x… wallet exempt from the opening tax"
            className="font-mono text-[13px]"
          />
          <Button
            variant="soft"
            icon={<Plus className="size-4" />}
            onClick={addExemption}
            disabled={!isAddress(exemptionInput.trim()) || draft.snipeTaxExemptions.length >= MAX_SNIPE_EXEMPTIONS}
          >
            Add
          </Button>
        </div>
        {showError('snipeTaxExemptions') && (
          <p className="text-[12.5px] font-medium text-danger">{showError('snipeTaxExemptions')}</p>
        )}
        {draft.snipeTaxExemptions.length > 0 && (
          <ul className="divide-y divide-ink-700/10 rounded-[12px] bg-ink-700/[0.04]">
            {draft.snipeTaxExemptions.map((address) => (
              <li key={address} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1 truncate font-mono text-[12.5px] text-ink-700">{address}</span>
                <button
                  onClick={() => patch({ snipeTaxExemptions: draft.snipeTaxExemptions.filter((a) => a !== address) })}
                  aria-label={`Remove ${shortAddress(address)}`}
                  className="flex size-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-700/8 hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[12px] text-ink-500">
          {draft.snipeTaxExemptions.length} of {MAX_SNIPE_EXEMPTIONS} · exemptions are held per recipient and cannot be added
          after launch.
        </p>
      </Section>

      {/* ---------------------------- Launch and buy ---------------------------- */}
      <Section
        title="Opening buy"
        description="Create the launch and buy into it in one transaction, so nothing can trade between the two. Your buy is exempt from the opening tax."
        icon={<Rocket className="size-4 text-brand-600" />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Amount in ${draft.quote.symbol}`} hint="Leave empty to launch without buying.">
            <Input
              inputMode="decimal"
              value={openingBuyInput}
              onChange={(e) => {
                setOpeningBuyInput(e.target.value)
                patch({ openingBuy: parseAmount(e.target.value, draft.quote.decimals) ?? 0n })
              }}
              placeholder="0"
              trailing={<span className="text-[13px] font-semibold">{draft.quote.symbol}</span>}
            />
          </Field>
          <Field label="Slippage" hint="Bounds the price, not the quantity." error={showError('slippageBps')}>
            <div className="flex h-11 items-center gap-1.5">
              {[50, 100, 300].map((bps) => (
                <button
                  key={bps}
                  type="button"
                  onClick={() => patch({ slippageBps: bps })}
                  className={cn(
                    'flex-1 rounded-[10px] py-2 text-[13px] font-semibold transition-colors',
                    draft.slippageBps === bps ? 'bg-brand-600 text-white' : 'bg-ink-700/8 text-ink-600 hover:bg-ink-700/12',
                  )}
                >
                  {fmtBps(bps)}
                </button>
              ))}
            </div>
          </Field>
        </div>
        {openingQuote && (
          <div className="rounded-[12px] bg-brand-600/[0.08] px-3.5 py-3 text-[13px] text-ink-700 shadow-[inset_0_0_0_0.5px_rgb(88_86_214/0.18)]">
            <p>
              <span className="font-bold text-ink-900">
                ≈ {fmtCompactUnits(openingQuote.tokensOut, 18)} ${draft.symbol || 'TOKEN'}
              </span>{' '}
              · {fmtPct(openingShare)} of supply
              {openingQuote.clamped && ' · fills the whole curve'}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-500">
              After the {fmtBps(draft.config.curveFeeBps)} trade fee
              {draft.creatorTaxBps ? ` and your ${fmtBps(draft.creatorTaxBps)} creator tax` : ''}. The router quotes the
              fresh curve; the contract enforces your slippage.
            </p>
          </div>
        )}
      </Section>

      {/* -------------------------------- Thread -------------------------------- */}
      <Section
        title="Thread"
        description="Announce the launch on MESH the moment it confirms. The post carries the token, so anyone reading it can open the curve."
        icon={<MessageSquareText className="size-4 text-brand-600" />}
      >
        <Switch checked={threadEnabled} onChange={setThreadEnabled} label="Post a thread when it's live" description={`Published as @${me.handle}, to everyone.`} />
        {threadEnabled && (
          <div className="space-y-1.5">
            <Textarea
              value={threadText}
              onChange={(e) => {
                setThreadTouched(true)
                setThreadText(e.target.value)
              }}
              rows={5}
              maxLength={2000}
            />
            <div className="flex items-center justify-between text-[12px] text-ink-500">
              <span>{threadText.length}/2000</span>
              {threadTouched && (
                <button
                  className="font-semibold text-brand-600 hover:text-brand-700"
                  onClick={() => {
                    setThreadTouched(false)
                  }}
                >
                  Reset to suggested
                </button>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* -------------------------------- Submit -------------------------------- */}
      <div className="panel space-y-3 p-4">
        <dl className="space-y-1 text-[13px]">
          <SummaryRow label="Launch fee" value={`${formatUnits(terms.launchFee, 18)} ETH`} />
          {draft.openingBuy > 0n && (
            <SummaryRow label="Opening buy" value={`${fmtUnits(draft.openingBuy, draft.quote.decimals)} ${draft.quote.symbol}`} />
          )}
          <SummaryRow
            label={draft.quote.isNative ? 'Sent with the transaction' : 'Sent as ETH'}
            value={`${formatUnits(totalValue, 18)} ETH${!draft.quote.isNative && draft.openingBuy > 0n ? ` + ${draft.quote.symbol} approval` : ''}`}
            strong
          />
        </dl>

        {!terms.launchEnabled && (
          <Notice tone="warn">
            Public launching is closed right now. Only whitelisted addresses can create a token — the button below
            checks yours.
          </Notice>
        )}
        {blocked && (
          <Notice tone="warn">
            <span className="font-semibold">{shortAddress(gate.account)}</span> is not whitelisted to launch. Write to
            contact@ponsfamily.com, or switch to a wallet that is.
          </Notice>
        )}
        {submitted && Object.keys(errors).length > 0 && (
          <Notice tone="warn">Fix the highlighted fields above before launching.</Notice>
        )}

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
            loading={!!progress}
            disabled={!!blocked || !gate}
            icon={<Rocket className="size-[18px]" />}
            onClick={() => void submit()}
          >
            {progress ? PROGRESS_LABEL[progress] : !gate ? 'Checking your address…' : draft.openingBuy > 0n ? 'Launch and buy' : 'Launch token'}
          </Button>
        )}

        <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-500">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          <span>
            Your wallet signs the transaction and pons never takes custody. pons v2 is under audit and should be
            treated as unaudited until the reports are published —{' '}
            <a href="https://docs.ponsfamily.com/v2#audits" target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">
              read the risk notes <ExternalLink className="inline size-3" />
            </a>
            .
          </span>
        </p>
      </div>
    </div>
  )
}

/* -------------------------------- Pieces -------------------------------- */

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description?: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="panel space-y-3 p-4">
      <div>
        <h2 className="flex items-center gap-2 text-[16px] font-bold tracking-[-0.02em] text-ink-900">
          {icon}
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={cn(strong ? 'font-semibold text-ink-800' : 'text-ink-500')}>{label}</dt>
      <dd className={cn('tabular-nums', strong ? 'font-bold text-ink-900' : 'font-semibold text-ink-800')}>{value}</dd>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'warn'; children: React.ReactNode }) {
  return (
    <p className={cn('rounded-[12px] px-3 py-2.5 text-[12.5px] leading-snug', tone === 'warn' && 'bg-warn/12 text-amber-800')}>
      {children}
    </p>
  )
}

/**
 * The quote asset. Native ETH first as a pill, the verified pair assets in a
 * searchable list — there are dozens, mostly tokenised stocks, and a plain
 * select buries them.
 */
function QuoteAssetPicker({ assets, value, onChange }: { assets: QuoteAsset[]; value: QuoteAsset; onChange: (a: QuoteAsset) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const native = assets.find((a) => a.isNative)
  const pairs = assets.filter((a) => !a.isNative)
  const matches = query
    ? pairs.filter((a) => `${a.symbol} ${a.name}`.toLowerCase().includes(query.toLowerCase()))
    : pairs

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {native && (
          <AssetPill active={value.isNative} onClick={() => onChange(native)}>
            {native.symbol}
          </AssetPill>
        )}
        {pairs.slice(0, 5).map((a) => (
          <AssetPill key={a.address} active={value.address === a.address} onClick={() => onChange(a)}>
            {a.symbol}
          </AssetPill>
        ))}
        <AssetPill active={!value.isNative && !pairs.slice(0, 5).some((a) => a.address === value.address)} onClick={() => setOpen((o) => !o)}>
          {pairs.length > 5 ? `${pairs.length - 5} more` : 'Other'}
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        </AssetPill>
      </div>
      {open && (
        <div className="panel-inset p-2 animate-[var(--animate-pop-in)]">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search approved assets…" autoFocus />
          <ul className="scroll-slim mt-2 max-h-56 overflow-y-auto">
            {matches.map((a) => (
              <li key={a.address}>
                <button
                  onClick={() => {
                    onChange(a)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left hover:bg-ink-700/[0.05]',
                    value.address === a.address && 'bg-brand-600/10',
                  )}
                >
                  <span className="w-14 shrink-0 text-[13.5px] font-bold text-ink-900">{a.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-500">{a.name}</span>
                  {value.address === a.address && <Check className="size-4 text-brand-600" />}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-2.5 py-3 text-[12.5px] text-ink-500">No approved asset matches.</li>}
          </ul>
        </div>
      )}
      {!value.isNative && (
        <p className="flex items-center gap-1.5 text-[12px] text-ink-500">
          <Badge tone="success" icon={<Check className="size-3" />}>
            Approved
          </Badge>
          {value.name} · {value.decimals} decimals · verified against the factory
        </p>
      )}
    </div>
  )
}

function AssetPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
        active ? 'bg-brand-600 text-white' : 'bg-ink-700/8 text-ink-600 hover:bg-ink-700/12',
      )}
    >
      {children}
    </button>
  )
}

/** What the chosen config and quote asset mean, in the terms a buyer will see. */
function ConfigSummary({ config, quote }: { config: LaunchConfigView; quote: QuoteAsset }) {
  const e = openingEconomics(config, quote)
  const items = [
    { label: 'Supply', value: fmtCompactUnits(config.supply, 18) },
    { label: 'Trade fee', value: fmtBps(config.curveFeeBps) },
    { label: 'Opening price', value: fmtPrice(e.openingPrice, quote.symbol) },
    { label: 'Graduates at', value: `${fmtUnits(e.graduationThreshold, quote.decimals)} ${quote.symbol}` },
    { label: 'Sold on the curve', value: fmtPct(Number(e.sellableTokens) / Number(config.supply)) },
    { label: 'Held for the pool', value: fmtPct(Number(e.reservedTokens) / Number(config.supply)) },
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[12px] bg-ink-700/[0.04] px-3.5 py-3 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-400">{i.label}</dt>
          <dd className="text-[13.5px] font-bold tabular-nums text-ink-900">{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** After a successful launch: where the token is, and what to do next. */
export function LaunchSuccess({ outcome }: { outcome: LaunchOutcome }) {
  const result = outcome.result!
  return (
    <div className="panel space-y-4 p-5 text-center animate-[var(--animate-pop-in)]">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/16 text-emerald-700">
        <Check className="size-7" strokeWidth={2.6} />
      </span>
      <div>
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink-900">Your token is live</h2>
        <p className="mt-1 text-[13.5px] text-ink-500">
          Deployed at <span className="font-mono text-ink-700">{shortAddress(result.token, 6, 4)}</span> on {PONS_CHAIN.name}.
          {result.tokensOut ? ` Your opening buy returned ${fmtCompactUnits(result.tokensOut, 18)} tokens.` : ''}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to={`/t/${result.token}`}>
          <Button icon={<Rocket className="size-4" />}>Open token page</Button>
        </Link>
        <a href={result.explorerUrl} target="_blank" rel="noreferrer">
          <Button variant="secondary" iconRight={<ExternalLink className="size-4" />}>
            Transaction
          </Button>
        </a>
        {outcome.post && (
          <Link to={`/post/${outcome.post.id}`}>
            <Button variant="secondary" icon={<MessageSquareText className="size-4" />}>
              Your thread
            </Button>
          </Link>
        )}
      </div>
      {!outcome.post && (
        <p className="text-[12.5px] text-ink-500">No thread was posted. You can write one from the token page.</p>
      )}
    </div>
  )
}

/** Shown while the factory is being read, before the form can exist. */
export function LaunchFormSkeleton() {
  return (
    <div className="panel flex items-center gap-3 p-5 text-[13.5px] text-ink-500">
      <Spinner className="size-4" />
      Reading launch terms from the factory — fee, configs, and approved quote assets…
      <X className="hidden" />
    </div>
  )
}
