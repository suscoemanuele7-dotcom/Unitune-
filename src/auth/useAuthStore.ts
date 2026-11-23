import { create } from 'zustand'
import type { AuthError, Session } from '@supabase/supabase-js'
import { config, type Backend } from '../lib/config'
import { supabase } from '../lib/supabase'
import { isRecord, readJson, removeKey, writeJson } from '../lib/storage'
import { t } from '../i18n'

export interface AppUser {
  id: string
  email: string | null
  displayName: string
}

type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

interface AuthState {
  backend: Backend
  status: AuthStatus
  user: AppUser | null
  init: () => () => void
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<'signedIn' | 'confirmEmail'>
  sendMagicLink: (email: string) => Promise<void>
  enterDemo: (displayName: string) => void
  signOut: () => Promise<void>
}

const DEMO_USER_KEY = 'unitune.demoUser'

function isAppUser(v: unknown): v is AppUser {
  return isRecord(v) && typeof v.id === 'string' && typeof v.displayName === 'string'
}

function userFromSession(session: Session | null): AppUser | null {
  if (!session) return null
  const meta = session.user.user_metadata
  const fromMeta = isRecord(meta) && typeof meta.display_name === 'string' ? meta.display_name : ''
  const email = session.user.email ?? null
  return { id: session.user.id, email, displayName: fromMeta || (email?.split('@')[0] ?? '') }
}

/** Messaggi d'errore di Supabase Auth in italiano. */
export function authErrorMessage(error: unknown): string {
  if (!navigator.onLine) return t.auth.errors.offline
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : ''
  const map: Record<string, string> = {
    invalid_credentials: t.auth.errors.invalidCredentials,
    email_not_confirmed: t.auth.errors.emailNotConfirmed,
    user_already_exists: t.auth.errors.userExists,
    email_exists: t.auth.errors.userExists,
    weak_password: t.auth.errors.weakPassword,
    over_email_send_rate_limit: t.auth.errors.rateLimit,
    over_request_rate_limit: t.auth.errors.rateLimit,
    validation_failed: t.auth.errors.invalidEmail,
    email_address_invalid: t.auth.errors.invalidEmail,
  }
  return map[code] ?? t.auth.errors.generic
}

function throwIf(error: AuthError | null): void {
  if (error) throw error
}

export const useAuthStore = create<AuthState>()((set) => ({
  backend: config.backend,
  status: 'loading',
  user: null,

  init() {
    if (!supabase) {
      const user = readJson(DEMO_USER_KEY, isAppUser)
      set({ status: user ? 'signedIn' : 'signedOut', user })
      return () => undefined
    }
    // La sessione è salvata localmente da supabase-js: funziona anche offline.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = userFromSession(session)
      set({ status: user ? 'signedIn' : 'signedOut', user })
    })
    return () => {
      data.subscription.unsubscribe()
    }
  },

  async signInWithPassword(email, password) {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    throwIf(error)
  },

  async signUp(email, password, displayName) {
    if (!supabase) return 'signedIn'
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() }, emailRedirectTo: window.location.origin },
    })
    throwIf(error)
    return data.session ? 'signedIn' : 'confirmEmail'
  },

  async sendMagicLink(email) {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    throwIf(error)
  },

  enterDemo(displayName) {
    const user: AppUser = { id: 'demo-user', email: null, displayName: displayName.trim() || 'Studente' }
    writeJson(DEMO_USER_KEY, user)
    set({ status: 'signedIn', user })
  },

  async signOut() {
    if (supabase) {
      // scope "local": esce da questo dispositivo anche se offline.
      await supabase.auth.signOut({ scope: 'local' })
    } else {
      removeKey(DEMO_USER_KEY)
    }
    set({ status: 'signedOut', user: null })
  },
}))
