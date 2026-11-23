import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { BottomNav } from './BottomNav'
import { MiniPlayer } from './MiniPlayer'
import { PlayerHost } from './PlayerHost'
import { Toasts } from './Toasts'
import { TrackActionsSheet } from './TrackActionsSheet'
import { OfflineBanner } from './common'
import { usePlayerStore } from '../player/usePlayerStore'

/**
 * Layout persistente: area contenuti scrollabile + zona inferiore fissa
 * (mini-player, bottom nav). Il layout NON viene smontato
 * cambiando pagina: PlayerHost (e quindi l'iframe) vive per tutta la sessione.
 */
export function AppShell() {
  const bottomRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  // Player e coda coprono tutto: il resto diventa inerte (non focusabile,
  // invisibile agli screen reader) finché sono aperti.
  const covered = pathname === '/player' || pathname === '/queue'
  // Con il player flottante visibile serve spazio in fondo per poter
  // scorrere gli ultimi elementi sopra di esso.
  const floating = usePlayerStore((s) => s.loadedUid !== null && s.queue.index >= 0 && !s.floatingCollapsed)

  // Altezza della zona inferiore → variabile CSS usata dal player flottante.
  useEffect(() => {
    const el = bottomRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--chrome-bottom', `${el.offsetHeight}px`)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [])

  // Ogni nuova pagina parte dall'alto.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-dvh flex-col">
      <OfflineBanner />
      <main ref={mainRef} inert={covered} className="pt-safe flex-1 overflow-y-auto">
        <div className={`mx-auto max-w-xl px-4 pt-4 ${floating ? 'pb-60' : 'pb-6'}`}>
          <Outlet />
        </div>
      </main>
      <div ref={bottomRef} inert={covered} className="shrink-0">
        <MiniPlayer />
        <BottomNav />
      </div>
      <PlayerHost />
      <TrackActionsSheet />
      <Toasts />
    </div>
  )
}
