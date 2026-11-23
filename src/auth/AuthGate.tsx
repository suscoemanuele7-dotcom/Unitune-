import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useLibraryStore } from '../data/useLibraryStore'
import { readJson } from '../lib/storage'
import { useAuthStore } from './useAuthStore'

export const ONBOARDING_KEY = 'unitune.onboarding.done'

/**
 * Inizializza l'autenticazione e collega la libreria all'utente corrente.
 * Ricarica la libreria al login e quando torna la connessione.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)

  useEffect(() => useAuthStore.getState().init(), [])

  useEffect(() => {
    const library = useLibraryStore.getState()
    library.bindUser(user)
    if (!user) return
    void library.refresh()
    const onOnline = () => {
      void useLibraryStore.getState().refresh()
    }
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
    }
  }, [user])

  return children
}

/** Protegge le pagine dell'app: senza login si va a onboarding/login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()
  if (status === 'loading') {
    return <div className="h-dvh bg-bg" aria-busy="true" />
  }
  if (status === 'signedOut') {
    const onboarded = readJson(ONBOARDING_KEY, (v): v is boolean => typeof v === 'boolean') === true
    return <Navigate to={onboarded ? '/login' : '/welcome'} replace state={{ from: location.pathname }} />
  }
  return children
}
