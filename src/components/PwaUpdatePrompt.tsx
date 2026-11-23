import { useRegisterSW } from 'virtual:pwa-register/react'
import { t } from '../i18n'

/**
 * Registra il service worker e avvisa quando c'è una nuova versione.
 * L'aggiornamento non è forzato per non interrompere l'ascolto.
 * Montato alla radice dell'app (fuori dal router): il SW si registra già
 * dalla prima visita, anche su benvenuto/login, così l'intera shell
 * funziona offline.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error: unknown) {
      console.error('Registrazione service worker fallita', error)
    },
  })

  if (!needRefresh && !offlineReady) return null

  const close = () => {
    setNeedRefresh(false)
    setOfflineReady(false)
  }

  return (
    <div
      role="status"
      className="fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm shadow-lg"
      style={{ bottom: 'calc(var(--chrome-bottom, 0px) + 12px)' }}
    >
      <p className="flex-1">{needRefresh ? t.pwa.updateAvailable : t.pwa.offlineReady}</p>
      {needRefresh && (
        <button
          type="button"
          className="rounded-full bg-accent px-3 py-1.5 font-semibold text-white"
          onClick={() => void updateServiceWorker(true)}
        >
          {t.pwa.update}
        </button>
      )}
      <button type="button" className="text-muted hover:text-text" onClick={close}>
        {needRefresh ? t.pwa.later : t.pwa.close}
      </button>
    </div>
  )
}
