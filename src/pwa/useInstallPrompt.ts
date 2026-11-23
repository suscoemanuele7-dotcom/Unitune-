/**
 * Prompt di installazione PWA.
 * - Chrome/Edge/Android: evento `beforeinstallprompt` (lo catturiamo presto,
 *   all'import di questo modulo, perché può arrivare prima del render).
 * - iOS Safari: nessun evento; mostriamo le istruzioni "Aggiungi a Home".
 */
import { create } from 'zustand'
import { readJson, writeJson } from '../lib/storage'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'unitune.install.dismissed'

interface InstallState {
  deferred: BeforeInstallPromptEvent | null
  installed: boolean
  dismissed: boolean
  promptInstall: () => Promise<boolean>
  dismiss: () => void
}

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)

export const isIos = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

export const useInstallPrompt = create<InstallState>()((set, get) => ({
  deferred: null,
  installed: false,
  dismissed: readJson(DISMISS_KEY, (v): v is boolean => typeof v === 'boolean') ?? false,
  async promptInstall() {
    const event = get().deferred
    if (!event) return false
    await event.prompt()
    const { outcome } = await event.userChoice
    set({ deferred: null, installed: outcome === 'accepted' })
    return outcome === 'accepted'
  },
  dismiss() {
    writeJson(DISMISS_KEY, true)
    set({ dismissed: true })
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    useInstallPrompt.setState({ deferred: e as BeforeInstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => {
    useInstallPrompt.setState({ deferred: null, installed: true })
  })
}

/** Si può proporre l'installazione su questo dispositivo? */
export function useCanInstall(): 'prompt' | 'ios' | null {
  const deferred = useInstallPrompt((s) => s.deferred)
  const installed = useInstallPrompt((s) => s.installed)
  if (installed || isStandalone()) return null
  if (deferred) return 'prompt'
  return isIos() ? 'ios' : null
}
