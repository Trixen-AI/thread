import { useState } from 'react'
import { Check, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setUi, useApp } from '@/store/appStore'
import { switchNetwork, toast } from '@/store/actions'
import {
  TOKENS,
  allChains,
  loadCustomChains,
  removeCustomChain,
  saveCustomChain,
} from '@/services/blockchain'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'

/**
 * Network switcher.
 *
 * Mainnets are ordinary here — this is a payments surface. Testnets are marked
 * so the difference is never a matter of remembering.
 *
 * The list is open: MESH ships parameters only for chains it can state with
 * confidence, and anything else is added from the values that chain publishes.
 */
export function NetworkModal() {
  const state = useApp()
  const open = state.ui.walletSheet === 'network'
  const current = state.wallet.account?.chainId ?? null
  const [adding, setAdding] = useState(false)
  const [, bump] = useState(0)

  const close = () => {
    setUi({ walletSheet: null })
    setAdding(false)
  }

  const chains = allChains()
  const customIds = new Set(loadCustomChains().map((c) => c.id))
  const unknownCurrent = current !== null && !chains.some((c) => c.id === current)

  return (
    <Modal
      open={open}
      onClose={close}
      title="Network"
      description="Your wallet will ask you to confirm the switch."
    >
      {adding ? (
        <AddNetworkForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            bump((n) => n + 1)
          }}
          prefillId={unknownCurrent ? current : undefined}
        />
      ) : (
        <div className="space-y-2">
          {unknownCurrent && (
            <div className="rounded-[12px] bg-warn/14 px-3.5 py-3 text-[12.5px] leading-snug text-amber-900">
              <p className="font-semibold">
                Your wallet is on chain {current}, which MESH has no details for.
              </p>
              <p className="mt-1">
                Balances show the native currency only. Add it below to give it a name, a token
                list and an explorer link.
              </p>
            </div>
          )}

          {chains.map((chain) => {
            const active = current === chain.id
            const tokens = TOKENS[chain.id] ?? []
            const isCustom = customIds.has(chain.id)
            return (
              <div
                key={chain.id}
                className={cn(
                  'panel flex items-center gap-3 px-3.5 py-3 transition-colors',
                  active ? 'bg-brand-600/[0.08]' : 'hover:bg-ink-700/[0.05]',
                )}
              >
                <button
                  onClick={async () => {
                    if (!active) await switchNetwork(chain.id)
                    close()
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-ink-900">
                    {chain.name}
                    {chain.testnet && (
                      <Badge tone="warn" icon={<TriangleAlert className="size-3" />}>
                        Testnet
                      </Badge>
                    )}
                    {isCustom && <Badge tone="neutral">Added by you</Badge>}
                  </span>
                  <span className="block text-[12px] text-ink-500">
                    Chain {chain.id} · {chain.nativeCurrency.symbol}
                    {tokens.length > 0 && ` · ${tokens.map((t) => t.symbol).join(', ')}`}
                  </span>
                </button>

                {active && <Check className="size-[18px] shrink-0 text-brand-600" />}
                {isCustom && !active && (
                  <button
                    onClick={() => {
                      removeCustomChain(chain.id)
                      bump((n) => n + 1)
                    }}
                    aria-label={`Remove ${chain.name}`}
                    className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            )
          })}

          <Button
            block
            variant="secondary"
            className="!mt-3"
            icon={<Plus className="size-[18px]" />}
            onClick={() => setAdding(true)}
          >
            Add a network
          </Button>
        </div>
      )}
    </Modal>
  )
}

function AddNetworkForm({
  onCancel,
  onSaved,
  prefillId,
}: {
  onCancel: () => void
  onSaved: () => void
  prefillId?: number
}) {
  const [name, setName] = useState('')
  const [id, setId] = useState(prefillId ? String(prefillId) : '')
  const [symbol, setSymbol] = useState('')
  const [rpcUrl, setRpcUrl] = useState('')
  const [explorerUrl, setExplorerUrl] = useState('')
  const [error, setError] = useState<string>()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const chainId = Number(id)

    if (!Number.isInteger(chainId) || chainId <= 0) {
      return setError('Chain ID must be a whole number.')
    }
    if (!name.trim()) return setError('Give the network a name.')
    if (!symbol.trim()) return setError('Enter the native currency ticker.')
    try {
      const url = new URL(rpcUrl.trim())
      if (url.protocol !== 'https:') return setError('The RPC URL must use https.')
    } catch {
      return setError('Enter a valid RPC URL.')
    }

    saveCustomChain({
      id: chainId,
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      rpcUrl: rpcUrl.trim(),
      explorerUrl: explorerUrl.trim() || undefined,
    })
    toast({ title: `${name.trim()} added`, tone: 'success', icon: 'check' })
    onSaved()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="rounded-[12px] bg-ink-700/[0.06] px-3.5 py-3 text-[12.5px] leading-snug text-ink-600">
        Use the parameters the network itself publishes. MESH will not guess them for you — a
        wrong chain ID or RPC is how funds end up somewhere they cannot be recovered from.
      </p>

      <Field label="Network name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Network" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Chain ID">
          <Input
            value={id}
            onChange={(e) => setId(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            placeholder="8453"
          />
        </Field>
        <Field label="Currency symbol">
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="ETH"
            autoCapitalize="characters"
          />
        </Field>
      </div>

      <Field label="RPC URL" hint="Must be https.">
        <Input
          value={rpcUrl}
          onChange={(e) => setRpcUrl(e.target.value)}
          placeholder="https://rpc.example.com"
          spellCheck={false}
        />
      </Field>

      <Field label="Block explorer (optional)">
        <Input
          value={explorerUrl}
          onChange={(e) => setExplorerUrl(e.target.value)}
          placeholder="https://explorer.example.com"
          spellCheck={false}
        />
      </Field>

      {error && (
        <p className="rounded-[12px] bg-danger/12 px-3 py-2 text-[12.5px] font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Add network
        </Button>
      </div>
    </form>
  )
}
