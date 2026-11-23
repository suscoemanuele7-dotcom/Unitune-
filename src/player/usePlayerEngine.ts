/**
 * Motore del player: collega lo store Zustand all'unico YouTubePlayer.
 * Montato una volta sola (in PlayerHost) per tutta la vita dell'app.
 */
import { useEffect, type RefObject } from 'react'
import { useLibraryStore } from '../data/useLibraryStore'
import { usePlayerStore } from './usePlayerStore'
import { YouTubePlayer } from './YouTubePlayer'

const TICK_MS = 500
/** Un ascolto entra in cronologia dopo 30 s (o metà brano, se più corto). */
const HISTORY_MIN_SEC = 30
const AUTOPLAY_CHECK_MS = 5000

export function usePlayerEngine(containerRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const store = usePlayerStore
    let player: YouTubePlayer | null = null
    let creating: Promise<YouTubePlayer> | null = null
    let disposed = false
    let listenedSec = 0
    let recordedUid: string | null = null

    function ensurePlayer(): Promise<YouTubePlayer> {
      if (player) return Promise.resolve(player)
      if (!creating) {
        const container = containerRef.current
        if (!container) return Promise.reject(new Error('Contenitore del player mancante'))
        const mount = document.createElement('div')
        container.appendChild(mount)
        creating = YouTubePlayer.create(mount, {
          onStateChange: (state) => {
            const s = store.getState()
            if (state === 'ended') s._onEnded()
            else s._onStatus(state)
          },
          onError: (code) => {
            store.getState()._onError(code)
          },
          onAutoplayBlocked: () => {
            store.getState()._onAutoplayBlocked()
          },
        })
          .then((p) => {
            player = p
            const { volume, muted } = store.getState()
            p.setVolume(volume)
            p.setMuted(muted)
            return p
          })
          .catch((error: unknown) => {
            creating = null
            mount.remove()
            throw error
          })
      }
      return creating
    }

    async function handleLoad() {
      const request = store.getState().loadRequest
      if (!request) return
      try {
        const p = await ensurePlayer()
        if (disposed || store.getState().loadRequest?.token !== request.token) return
        listenedSec = 0
        if (request.autoplay) p.loadVideoById(request.videoId, request.startAt)
        else p.cueVideoById(request.videoId, request.startAt)
        store.getState()._loaded(request.uid)
        if (request.autoplay) {
          // Non tutti i browser emettono onAutoplayBlocked: se dopo qualche
          // secondo il video non è partito, chiediamo un tocco sul player.
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
      if (state.loadRequest !== prev.loadRequest && state.loadRequest) void handleLoad()
      if (!player) return
      if (state.wantsToPlay !== prev.wantsToPlay && state.loadedUid === state.loadRequest?.uid) {
        if (state.wantsToPlay) player.playVideo()
        else player.pauseVideo()
      }
      if (state.seekRequest !== prev.seekRequest && state.seekRequest) player.seekTo(state.seekRequest.time)
      if (state.volume !== prev.volume) player.setVolume(state.volume)
      if (state.muted !== prev.muted) player.setMuted(state.muted)
    })

    const interval = setInterval(() => {
      const s = store.getState()
      if (!player || (s.status !== 'playing' && s.status !== 'buffering')) return
      const time = player.getCurrentTime()
      const duration = player.getDuration()
      s._onProgress(time, duration)

      if (s.status !== 'playing') return
      listenedSec += TICK_MS / 1000
      const item = s.queue.items[s.queue.index]
      const threshold = duration > 0 ? Math.min(HISTORY_MIN_SEC, duration / 2) : HISTORY_MIN_SEC
      if (item && recordedUid !== item.uid && listenedSec >= threshold) {
        recordedUid = item.uid
        void useLibraryStore.getState().recordPlay(item.track)
      }
    }, TICK_MS)

    // Nuovo brano caricato → si riparte a contare l'ascolto.
    const unsubscribeUid = store.subscribe((state, prev) => {
      if (state.loadRequest?.token !== prev.loadRequest?.token && state.loadRequest?.uid !== recordedUid) {
        listenedSec = 0
      }
      // "Ripeti brano": lo stesso uid rientra in cronologia a ogni giro.
      if (state.loadRequest?.token !== prev.loadRequest?.token && state.loadRequest?.uid === recordedUid) {
        recordedUid = null
        listenedSec = 0
      }
    })

    return () => {
      disposed = true
      unsubscribe()
      unsubscribeUid()
      clearInterval(interval)
      player?.destroy()
      player = null
    }
  }, [containerRef])
}
