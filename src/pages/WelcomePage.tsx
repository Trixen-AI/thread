import { useEffect, useRef, useState } from 'react'
import { AtSign, Check, Loader2, Lock, User as UserIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sceneUrl } from '@/data/visuals'
import { register, signIn } from '@/store/actions'
import { useApp } from '@/store/appStore'
import { ApiError, api } from '@/services/api/client'
import { Logo, LogoTile } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'

type Mode = 'intro' | 'register' | 'signin'

/**
 * First run — and the only screen that creates accounts.
 *
 * Handles are checked for availability as you type, and the password rule is
 * stated up front rather than after a failed submit.
 */
export function WelcomePage() {
  const { status, connectionError } = useApp()
  const [mode, setMode] = useState<Mode>('intro')

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink-950">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: sceneUrl('grid', 0),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(42rem 32rem at 18% 8%, rgb(88 86 214 / 0.55), transparent 62%),' +
            'radial-gradient(38rem 30rem at 88% 92%, rgb(175 82 222 / 0.4), transparent 64%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/55 via-ink-950/75 to-ink-950/95" />

      <div className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-6 py-12">
        <div className="text-center">
          <LogoTile
            rounded="rounded-[26px]"
            className="mx-auto size-[80px] shadow-[0_18px_44px_-12px_rgb(88_86_214/0.75)]"
          />
          <h1 className="mt-7 text-[44px] font-bold leading-none tracking-[-0.045em] text-white">
            MESH
          </h1>
          <p className="mt-4 text-[18px] font-medium leading-[1.45] tracking-[-0.02em] text-white/70">
            Your Identity.
            <br />
            Your Network.
            <br />
            Your Value.
          </p>
        </div>

        {status === 'offline' && (
          <div className="mt-8 rounded-[16px] bg-danger/15 px-4 py-3 text-[13px] leading-snug text-red-200">
            <strong className="font-semibold">Cannot reach the MESH server.</strong>{' '}
            {connectionError} Start it with <code className="font-mono">npm run dev</code>.
          </div>
        )}

        <div className="mt-10">
          {mode === 'intro' && <Intro onPick={setMode} />}
          {mode === 'register' && <RegisterForm onBack={() => setMode('intro')} />}
          {mode === 'signin' && <SignInForm onBack={() => setMode('intro')} />}
        </div>
      </div>

      <footer className="relative pb-8 text-center">
        <Logo wordmark="light" className="opacity-40" markClassName="size-6" />
      </footer>
    </div>
  )
}

function Intro({ onPick }: { onPick: (mode: Mode) => void }) {
  return (
    <div className="space-y-2.5">
      <Button block size="lg" className="rounded-[16px]" onClick={() => onPick('register')}>
        Create account
      </Button>
      <Button
        block
        size="lg"
        variant="secondary"
        className="rounded-[16px]"
        onClick={() => onPick('signin')}
      >
        I already have an account
      </Button>
    </div>
  )
}

/* ------------------------------- Form parts ------------------------------- */

function FieldRow({
  icon,
  error,
  hint,
  children,
  trailing,
}: {
  icon: React.ReactNode
  error?: string
  hint?: string
  children: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div>
      <div
        className={cn(
          'glass-thick flex h-[52px] items-center gap-2.5 rounded-[16px] px-3.5',
          error && 'shadow-[inset_0_0_0_1.5px_var(--color-danger)]',
        )}
      >
        <span className="shrink-0 text-ink-400">{icon}</span>
        {children}
        {trailing}
      </div>
      {(error || hint) && (
        <p
          className={cn(
            'px-1.5 pt-1.5 text-[12px] leading-snug',
            error ? 'text-red-300' : 'text-white/45',
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

const inputClass =
  'min-w-0 flex-1 bg-transparent text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none'

function RegisterForm({ onBack }: { onBack: () => void }) {
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle')
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Check the handle as the user types, so the collision is caught before submit.
  useEffect(() => {
    clearTimeout(debounce.current)
    const value = handle.trim().toLowerCase()
    if (value.length < 3) {
      setAvailability('idle')
      return
    }
    setAvailability('checking')
    debounce.current = setTimeout(async () => {
      try {
        const { available } = await api.handleAvailable(value)
        setAvailability(available ? 'free' : 'taken')
      } catch {
        setAvailability('idle')
      }
    }, 350)
    return () => clearTimeout(debounce.current)
  }, [handle])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await register({ handle: handle.trim().toLowerCase(), name: name.trim(), password })
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields ?? { form: error.message })
      } else {
        setErrors({ form: 'Something went wrong' })
      }
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <FieldRow
        icon={<AtSign className="size-[18px]" />}
        error={errors.handle ?? (availability === 'taken' ? 'That handle is taken.' : undefined)}
        hint="3–20 characters. Letters, numbers and underscore."
        trailing={
          availability === 'checking' ? (
            <Loader2 className="size-4 shrink-0 animate-[var(--animate-spin-slow)] text-ink-400" />
          ) : availability === 'free' ? (
            <Check className="size-[18px] shrink-0 text-success" />
          ) : availability === 'taken' ? (
            <X className="size-[18px] shrink-0 text-danger" />
          ) : null
        }
      >
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
          placeholder="handle"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Handle"
          className={inputClass}
        />
      </FieldRow>

      <FieldRow icon={<UserIcon className="size-[18px]" />} error={errors.name}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
          autoComplete="name"
          aria-label="Display name"
          className={inputClass}
        />
      </FieldRow>

      <FieldRow
        icon={<Lock className="size-[18px]" />}
        error={errors.password}
        hint="At least 8 characters."
      >
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          aria-label="Password"
          className={inputClass}
        />
      </FieldRow>

      {errors.form && (
        <p className="rounded-[12px] bg-danger/15 px-3 py-2 text-[12.5px] text-red-200">
          {errors.form}
        </p>
      )}

      <Button
        type="submit"
        block
        size="lg"
        className="!mt-4 rounded-[16px]"
        loading={busy}
        disabled={!handle || !name || !password || availability === 'taken'}
      >
        Create account
      </Button>
      <Button
        type="button"
        block
        variant="ghost"
        className="rounded-[16px] text-white/60 hover:bg-white/10 hover:text-white"
        onClick={onBack}
      >
        Back
      </Button>

      <p className="pt-1 text-center text-[11.5px] leading-relaxed text-white/35">
        This is a self-hosted dev server without HTTPS. Pick a password you do not use anywhere
        else.
      </p>
    </form>
  )
}

function SignInForm({ onBack }: { onBack: () => void }) {
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await signIn({ handle: handle.trim().toLowerCase(), password })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <FieldRow icon={<AtSign className="size-[18px]" />}>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="handle"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-label="Handle"
          className={inputClass}
        />
      </FieldRow>

      <FieldRow icon={<Lock className="size-[18px]" />}>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          aria-label="Password"
          className={inputClass}
        />
      </FieldRow>

      {error && (
        <p className="rounded-[12px] bg-danger/15 px-3 py-2 text-[12.5px] text-red-200">{error}</p>
      )}

      <Button
        type="submit"
        block
        size="lg"
        className="!mt-4 rounded-[16px]"
        loading={busy}
        disabled={!handle || !password}
      >
        Sign in
      </Button>
      <Button
        type="button"
        block
        variant="ghost"
        className="rounded-[16px] text-white/60 hover:bg-white/10 hover:text-white"
        onClick={onBack}
      >
        Back
      </Button>
    </form>
  )
}
