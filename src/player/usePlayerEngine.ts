/**
 * Motore del player: collega lo store Zustand ai due motori di riproduzione
 * (YouTube IFrame e <audio> per Audius) e sceglie quello giusto per ogni
 * brano. Montato una volta sola (in PlayerHost) per tutta la vita dell'app.
 */
import { useEffect, type RefObject } from 'react'
import { audius } from '../api/audius'
import { useLibraryStore } from '../data/useLibraryStore'
import type { TrackSource } from '../types'
import { AudioBackend, YouTubeBackend, type PlaybackBackend } from './backends'
import { usePlayerStore } from './usePlayerStore'
import type { PlayerStateName } from './YouTubePlayer'

const TICK_MS = 500
/** Un ascolto entra in cronologia dopo 30 s (o metà brano, se più corto). */
const HISTORY_MIN_SEC = 30
const AUTOPLAY_CHECK_MS = 5000

export function usePlayerEngine(containerRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const store = usePlayerStore
    let disposed = false
    let active: PlaybackBackend | null = null
    let listenedSec = 0
    let recordedUid: string | null = null
    let lastTick = { wall: 0, media: 0 }

    // Gli eventi del motore NON attivo vengono ignorati: ad esempio la pausa
    // di YouTube causata dal passaggio a un brano Audius.
    const forward = (source: TrackSource) => ({
      onStateChange: (state: PlayerStateName) => {
        if (disposed || active?.source !== source) return
        const s = store.getState()
        if (state === 'ended') s._onEnded()
        else s._onStatus(state)
      },
      onError: (code: Parameters<ReturnType<typeof store.getState>['_onError']>[0]) => {
        if (!disposed && active?.source === source) store.getState()._onError(code)
      },
      onAutoplayBlocked: () => {
        if (!disposed && active?.source === source) store.getState()._onAutoplayBlocked()
      },
    })

    const backends: Record<TrackSource, PlaybackBackend> = {
      youtube: new YouTubeBackend(() => containerRef.current, forward('youtube')),
      audius: new AudioBackend(forward('audius'), (id) => audius.streamUrl(id)),
    }
    const { volume, muted } = store.getState()
    for (const b of Object.values(backends)) {
      b.setVolume(volume)
      b.setMuted(muted)
    }

    async function handleLoad() {
      const request = store.getState().loadRequest
      if (!request) return
      const next = backends[request.track.source]
      if (active !== next) {
        const previous = active
        active = next // prima di mettere in pausa il vecchio: i suoi eventi vanno ignorati
        previous?.pause()
      }
      listenedSec = 0
      lastTick = { wall: Date.now(), media: request.startAt }
      try {
        await next.load(request.track, request.startAt, request.autoplay)
        if (disposed || store.getState().loadRequest?.token !== request.token) return
        store.getState()._loaded(request.uid)
        if (request.autoplay) {
          // Non tutti i browser segnalano l'autoplay bloccato: se dopo qualche
          // secondo non è partito nulla, chiediamo un tocco.
          setTimeout(() => {
            const s = store.getState()
            if (!disposed && s.loadRequest?.token === request.token && s.status === 'loading') {
              s._onAutoplayBlocked()
            }
          }, AUTOPLAY_CHECK_MS)
        }
      } catch (error) {
        console.error(error)
        store.getState()._onError(navigator.onLine ? 'api_load_failed' : 'offline')
      }
    }

    const unsubscribe = store.subscribe((state, prev) => {
      if (state.loadRequest !== prev.loadRequest && state.loadRequest) {
        // "Ripeti brano": lo stesso uid rientra in cronologia a ogni giro.
        if (state.loadRequest.uid === recordedUid) recordedUid = null
        void handleLoad()
      }
      if (!active) return
      if (state.wantsToPlay !== prev.wantsToPlay && state.loadedUid === state.loadRequest?.uid) {
        if (state.wantsToPlay) active.play()
        else active.pause()
      }
      if (state.seekRequest !== prev.seekRequest && state.seekRequest) active.seek(state.seekRequest.time)
      if (state.volume !== prev.volume) for (const b of Object.values(backends)) b.setVolume(state.volume)
      if (state.muted !== prev.muted) for (const b of Object.values(backends)) b.setMuted(state.muted)
    })

    const interval = setInterval(() => {
      const s = store.getState()
      if (!active || (s.status !== 'playing' && s.status !== 'buffering')) return
      const time = active.currentTime()
      const duration = active.duration()
      s._onProgress(time, duration)

      // Tempo di ascolto reale: avanzamento del brano, ma mai più del tempo
      // trascorso (un salto in avanti non conta come ascolto). Funziona anche
      // se il browser rallenta i timer con lo schermo spento.
      const now = Date.now()
      const wallSec = (now - lastTick.wall) / 1000
      const mediaSec = time - lastTick.media
      lastTick = { wall: now, media: time }
      if (s.status === 'playing' && mediaSec > 0) listenedSec += Math.min(mediaSec, wallSec + 1)

      const item = s.queue.items[s.queue.index]
      const threshold = duration > 0 ? Math.min(HISTORY_MIN_SEC, duration / 2) : HISTORY_MIN_SEC
      if (item && recordedUid !== item.uid && listenedSec >= threshold) {
        recordedUid = item.uid
        void useLibraryStore.getState().recordPlay(item.track)
      }
    }, TICK_MS)

    return () => {
      disposed = true
      unsubscribe()
      clearInterval(interval)
      for (const b of Object.values(backends)) b.destroy()
    }
  }, [containerRef])
}
