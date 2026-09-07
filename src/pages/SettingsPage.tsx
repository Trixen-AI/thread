import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  Eye,
  LogOut,
  Palette,
  Shield,
  User as UserIcon,
  Wallet,
} from 'lucide-react'
import { shortAddress } from '@/lib/utils'
import { selectCurrentUser, useApp } from '@/store/appStore'
import { connectWallet, disconnectWallet, signOut, updateProfile } from '@/store/actions'
import { AppShell } from '@/components/layout/AppShell'
import { MobileTopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, DemoBadge } from '@/components/ui/Badge'
import { Field, Input, Switch, Textarea } from '@/components/ui/Field'

export function SettingsPage() {
  const state = useApp()
  const me = selectCurrentUser(state)
  const navigate = useNavigate()

  const [name, setName] = useState(me.name)
  const [bio, setBio] = useState(me.bio)
  const [website, setWebsite] = useState(me.website ?? '')
  const [location, setLocation] = useState(me.location ?? '')
  const [prefs, setPrefs] = useState({
    likes: true,
    comments: true,
    follows: true,
    tips: true,
    privateCollection: false,
    showWallet: true,
    reducedMotion: false,
  })

  const dirty =
    name !== me.name ||
    bio !== me.bio ||
    website !== (me.website ?? '') ||
    location !== (me.location ?? '')

  return (
    <>
      <MobileTopBar title="Settings" showLogo={false} />
      <AppShell rail={null}>
        <div className="space-y-3 px-3 py-3 lg:px-0 lg:py-0">
          <div className="hidden lg:block">
            <h1 className="text-[28px] font-bold tracking-[-0.032em] text-ink-900">Settings</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-500">
              Your profile, notifications and connected accounts.
            </p>
          </div>

          {/* Profile */}
          <Card className="p-4">
            <SectionTitle icon={<UserIcon className="size-4" />}>Profile</SectionTitle>

            <div className="mt-3 flex items-center gap-3">
              <Avatar seed={me.avatar} size="xl" name={me.name} />
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink-900">@{me.handle}</p>
                <p className="text-[12.5px] text-ink-500">
                  Handles are permanent on MESH — they anchor your identity.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <Field label="Display name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Bio" hint="Two short lines read better than one long one.">
                <Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Location">
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                </Field>
                <Field label="Website">
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button
                disabled={!dirty}
                onClick={() => void updateProfile({ name, bio, location, website })}
              >
                Save changes
              </Button>
              {dirty && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setName(me.name)
                    setBio(me.bio)
                    setWebsite(me.website ?? '')
                    setLocation(me.location ?? '')
                  }}
                >
                  Discard
                </Button>
              )}
            </div>
          </Card>

          {/* Wallet */}
          <Card className="p-4">
            <SectionTitle icon={<Wallet className="size-4" />}>
              Wallet & identity
              {state.wallet.isDemo && <DemoBadge className="ml-2" />}
            </SectionTitle>

            {state.wallet.status === 'connected' ? (
              <>
                <div className="mt-3 flex items-center gap-3 panel p-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <Wallet className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-ink-900">
                      {state.wallet.account!.label}
                    </p>
                    <p className="font-mono text-[12px] text-ink-500">
                      {shortAddress(state.wallet.account!.address)} ·{' '}
                      {state.wallet.account!.chainName}
                    </p>
                  </div>
                  <Badge tone={state.ownershipVerified ? 'success' : 'neutral'}>
                    {state.ownershipVerified ? 'Verified' : 'Unverified'}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => navigate('/wallet')}>
                    Open wallet
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void disconnectWallet()}>
                    Disconnect
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-3">
                <p className="text-[13.5px] text-ink-600">
                  No wallet connected. Connecting one adds ownership — collectibles, memberships and
                  payments — to your MESH profile.
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  loading={state.wallet.status === 'connecting'}
                  onClick={() => void connectWallet()}
                >
                  Connect wallet
                </Button>
              </div>
            )}
          </Card>

          {/* Notifications */}
          <Card className="p-4">
            <SectionTitle icon={<Bell className="size-4" />}>Notifications</SectionTitle>
            <div className="mt-1">
              <Switch
                checked={prefs.likes}
                onChange={(v) => setPrefs({ ...prefs, likes: v })}
                label="Likes"
                description="When someone likes your post"
              />
              <Switch
                checked={prefs.comments}
                onChange={(v) => setPrefs({ ...prefs, comments: v })}
                label="Comments and mentions"
              />
              <Switch
                checked={prefs.follows}
                onChange={(v) => setPrefs({ ...prefs, follows: v })}
                label="New followers"
              />
              <Switch
                checked={prefs.tips}
                onChange={(v) => setPrefs({ ...prefs, tips: v })}
                label="Tips and collects"
                description="Payments that land on your posts"
              />
            </div>
          </Card>

          {/* Privacy */}
          <Card className="p-4">
            <SectionTitle icon={<Shield className="size-4" />}>Privacy</SectionTitle>
            <div className="mt-1">
              <Switch
                checked={prefs.showWallet}
                onChange={(v) => setPrefs({ ...prefs, showWallet: v })}
                label="Show wallet on profile"
                description="Your address stays truncated either way — the full value is never shown without an explicit reveal."
              />
              <Switch
                checked={prefs.privateCollection}
                onChange={(v) => setPrefs({ ...prefs, privateCollection: v })}
                label="Private collection"
                description="Hide your collectibles from other people"
              />
            </div>
          </Card>

          {/* Appearance */}
          <Card className="p-4">
            <SectionTitle icon={<Palette className="size-4" />}>Appearance</SectionTitle>
            <div className="mt-1">
              <Switch
                checked={prefs.reducedMotion}
                onChange={(v) => setPrefs({ ...prefs, reducedMotion: v })}
                label="Reduce motion"
                description="MESH already respects your system setting for this."
              />
            </div>
          </Card>

          <Card className="overflow-hidden p-1.5">
            <button
              onClick={() => navigate(`/u/${me.handle}`)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-ink-700/[0.05]"
            >
              <Eye className="size-[18px] text-ink-500" />
              <span className="flex-1 text-[14px] font-semibold text-ink-800">
                View your public profile
              </span>
              <ChevronRight className="size-4 text-ink-400" />
            </button>
            <button
              onClick={() => {
                void signOut()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-danger hover:bg-red-50"
            >
              <LogOut className="size-[18px]" />
              <span className="flex-1 text-[14px] font-semibold">Sign out</span>
            </button>
          </Card>

          <p className="px-1 pb-4 text-[12px] text-ink-400">
            MESH · Your Identity. Your Network. Your Value.
          </p>
        </div>
      </AppShell>
    </>
  )
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
      <span className="text-ink-400">{icon}</span>
      {children}
    </h2>
  )
}
