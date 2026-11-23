import { useId, useState, type SubmitEvent, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { authErrorMessage, useAuthStore } from '../auth/useAuthStore'
import { isRecord } from '../lib/storage'
import { t } from '../i18n'

type Tab = 'signIn' | 'signUp' | 'magic'

export function LoginPage() {
  const status = useAuthStore((s) => s.status)
  const backend = useAuthStore((s) => s.backend)
  const location = useLocation()
  const state: unknown = location.state
  const from = isRecord(state) && typeof state.from === 'string' ? state.from : '/'

  if (status === 'signedIn') return <Navigate to={from} replace />

  return (
    <div className="pt-safe pb-safe min-h-dvh bg-gradient-to-b from-accent/25 via-bg to-bg px-6">
      <div className="mx-auto flex max-w-sm flex-col gap-8 py-12">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-12 w-12 rounded-xl" />
          <span className="text-2xl font-bold">{t.appName}</span>
        </div>
        {backend === 'local' ? <DemoLogin /> : <SupabaseLogin />}
        <LegalNotice />
      </div>
    </div>
  )
}

function DemoLogin() {
  const [name, setName] = useState('')
  const enterDemo = useAuthStore((s) => s.enterDemo)
  const id = useId()
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        enterDemo(name)
      }}
    >
      <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
        <p className="font-semibold">{t.auth.demoTitle}</p>
        <p className="text-sm text-muted">{t.auth.demoBody}</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {t.auth.demoName}
        </label>
        <input
          id={id}
          className="input"
          autoComplete="given-name"
          maxLength={60}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
        />
      </div>
      <button type="submit" className="btn-primary w-full">
        {t.auth.demoEnter}
      </button>
    </form>
  )
}

function SupabaseLogin() {
  const [tab, setTab] = useState<Tab>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const auth = useAuthStore()
  const ids = { email: useId(), password: useId(), name: useId() }

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (tab === 'signIn') await auth.signInWithPassword(email, password)
      else if (tab === 'signUp') {
        const result = await auth.signUp(email, password, displayName)
        if (result === 'confirmEmail') setInfo(t.auth.confirmEmail)
      } else {
        await auth.sendMagicLink(email)
        setInfo(t.auth.magicSent)
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const tabs: [Tab, string][] = [
    ['signIn', t.auth.signIn],
    ['signUp', t.auth.signUp],
    ['magic', t.auth.magicLink],
  ]

  return (
    <div className="space-y-6">
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full bg-surface p-1 text-sm font-semibold">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`rounded-full px-2 py-2 transition ${tab === key ? 'bg-text text-bg' : 'text-muted'}`}
            onClick={() => {
              setTab(key)
              setError(null)
              setInfo(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {tab === 'signUp' && (
          <Field id={ids.name} label={t.auth.displayName}>
            <input
              id={ids.name}
              className="input"
              autoComplete="name"
              maxLength={60}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
              }}
            />
          </Field>
        )}
        <Field id={ids.email} label={t.auth.email}>
          <input
            id={ids.email}
            className="input"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
            }}
          />
        </Field>
        {tab !== 'magic' && (
          <Field id={ids.password} label={t.auth.password} hint={tab === 'signUp' ? t.auth.passwordHint : undefined}>
            <input
              id={ids.password}
              className="input"
              type="password"
              required
              minLength={tab === 'signUp' ? 8 : undefined}
              autoComplete={tab === 'signUp' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
              }}
            />
          </Field>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="rounded-lg bg-accent/15 px-3 py-2 text-sm">
            {info}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {tab === 'signIn' ? t.auth.submitSignIn : tab === 'signUp' ? t.auth.submitSignUp : t.auth.submitMagic}
        </button>
      </form>
    </div>
  )
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex justify-between text-sm font-medium">
        {label}
        {hint && <span className="font-normal text-muted">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

/**
 * Richiesto dai Termini delle YouTube API Services: gli utenti devono sapere
 * che sono vincolati dai Termini di YouTube e trovare l'informativa di Google.
 */
function LegalNotice() {
  const l = t.auth.legal
  const link = 'underline hover:text-text'
  return (
    <p className="text-xs text-muted">
      {l.prefix}
      <a className={link} href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
        {l.ytTerms}
      </a>
      {l.middle}
      <a className={link} href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
        {l.googlePrivacy}
      </a>
      {l.suffix}
    </p>
  )
}
