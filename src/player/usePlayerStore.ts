/**
 * Stato del player e della coda (Zustand).
 *
 * Lo store contiene solo STATO e INTENZIONI (es. "voglio riprodurre il
 * brano X dal secondo 30"). Chi parla davvero con l'iframe di YouTube è il
 * motore (usePlayerEngine), che osserva lo store e gli rimanda gli eventi.
 * Così la logica resta testabile e l'iframe non dipende da React.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Track } from '../types'
import type { PlayerErrorCode } from './YouTubePlayer'
import { findSimilarTracks } from './smartShuffleSource'
import { toast } from '../ui/useToastStore'
import { t } from '../i18n'
import {
  addToEnd,
  currentItem,
  cycleRepeat,
  emptyQueue,
  injectRecommended,
  insertNext,
  moveItem,
  nextBackgroundIndex,
  nextIndex,
  previousIndex,
  removeItem,
  removeRecommended,
  setQueue,
  toggleShuffle,
  type QueueState,
} from './queue'

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error'
export type PlaybackErrorCode = PlayerErrorCode | 'offline'

export interface LoadRequest {
  uid: string
  track: Track
  startAt: number
  autoplay: boolean
  token: number
}

const MAX_CONSECUTIVE_ERRORS = 5
const AUTO_SKIP_DELAY_MS = 1500
const RESTART_THRESHOLD_SEC = 3

interface PlayerState {
  queue: QueueState
  /** Da dove è partita la riproduzione (es. nome playlist). */
  contextLabel: string
  /** Playlist di partenza, se la riproduzione viene da una playlist. */
  contextPlaylistId: string | null
  /** Ricerca dei brani simili dello Smart Shuffle in corso. */
  smartLoading: boolean
  status: PlaybackStatus
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  error: { code: PlaybackErrorCode; track: Track | null } | null
  /** Il browser ha bloccato l'autoplay: serve un tocco sul player. */
  needsUserGesture: boolean
  /** Player flottante ridotto dall'utente (in pausa). */
  floatingCollapsed: boolean

  // ── Richieste per il motore ──
  loadRequest: LoadRequest | null
  loadedUid: string | null
  wantsToPlay: boolean
  seekRequest: { time: number; token: number } | null
  consecutiveErrors: number

  // ── Azioni dell'interfaccia ──
  playTracks: (
    tracks: readonly Track[],
    startIndex?: number,
    options?: { shuffle?: boolean; smart?: boolean; context?: string; playlistId?: string },
  ) => void
  addToQueue: (track: Track) => void
  playNext: (track: Track) => void
  removeFromQueue: (uid: string) => void
  moveInQueue: (from: number, to: number) => void
  jumpTo: (index: number) => void
  clearQueue: () => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  /** Spento → casuale → Smart Shuffle → spento (come nelle app musicali). */
  cycleShuffle: () => void
  cycleRepeat: () => void
  setFloatingCollapsed: (collapsed: boolean) => void
  dismissError: () => void

  // ── Eventi dal motore ──
  _loaded: (uid: string) => void
  _onStatus: (status: 'playing' | 'paused' | 'buffering' | 'unstarted' | 'cued') => void
  _onProgress: (time: number, duration: number) => void
  _onEnded: () => void
  _onError: (code: PlaybackErrorCode) => void
  _onAutoplayBlocked: () => void
}

/** Errori per cui ha senso passare da soli al brano successivo. */
const SKIPPABLE: ReadonlySet<PlaybackErrorCode> = new Set(['not_found', 'embed_disabled', 'html5', 'invalid_param'])

/** true se dopo questo errore il player passerà da solo al brano successivo. */
export function willAutoSkip(s: Pick<PlayerState, 'queue' | 'error' | 'consecutiveErrors'>): boolean {
  if (!s.error || !SKIPPABLE.has(s.error.code) || s.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) return false
  const next = nextIndex(s.queue, false)
  return next !== null && next !== s.queue.index
}

let token = 0
let smartAbort: AbortController | null = null
let skipTimer: ReturnType<typeof setTimeout> | undefined
const rng = () => Math.random()

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => {
      /** Prepara il caricamento del brano in posizione `index`. */
      function loadIndex(queue: QueueState, index: number, autoplay: boolean, startAt = 0) {
        clearTimeout(skipTimer)
        const item = queue.items[index]
        if (!item) {
          set({ queue: { ...queue, index: queue.items.length ? Math.min(index, queue.items.length - 1) : -1 } })
          return
        }
        if (autoplay && !isOnline()) {
          set({
            queue: { ...queue, index },
            status: 'error',
            wantsToPlay: false,
            error: { code: 'offline', track: item.track },
          })
          return
        }
        token += 1
        set({
          queue: { ...queue, index },
          status: autoplay ? 'loading' : 'paused',
          currentTime: startAt,
          duration: item.track.durationSec ?? 0,
          error: null,
          wantsToPlay: autoplay,
          floatingCollapsed: autoplay ? false : get().floatingCollapsed,
          loadRequest: { uid: item.uid, track: item.track, startAt, autoplay, token },
        })
      }

      /** Cerca brani simili e li inserisce nella coda (Smart Shuffle). */
      function fillSmart() {
        smartAbort?.abort()
        const controller = new AbortController()
        smartAbort = controller
        const context = get()
          .queue.items.filter((i) => !i.recommended)
          .map((i) => i.track)
        set({ smartLoading: true })
        findSimilarTracks(context, controller.signal)
          .then((recs) => {
            if (controller.signal.aborted || !get().queue.smart) return
            if (recs.length === 0) toast(t.player.smartNone)
            else set({ queue: injectRecommended(get().queue, recs) })
          })
          .catch(() => {
            if (!controller.signal.aborted) toast(t.player.smartNone)
          })
          .finally(() => {
            if (smartAbort === controller) set({ smartLoading: false })
          })
      }

      return {
        queue: emptyQueue,
        contextLabel: '',
        contextPlaylistId: null,
        smartLoading: false,
        status: 'idle',
        currentTime: 0,
        duration: 0,
        volume: 100,
        muted: false,
        error: null,
        needsUserGesture: false,
        floatingCollapsed: false,
        loadRequest: null,
        loadedUid: null,
        wantsToPlay: false,
        seekRequest: null,
        consecutiveErrors: 0,

        playTracks(tracks, startIndex = 0, options = {}) {
          smartAbort?.abort()
          const smart = options.smart ?? (options.shuffle === false ? false : get().queue.smart)
          const shuffle = smart || (options.shuffle ?? get().queue.shuffle)
          const queue = { ...setQueue(get().queue, tracks, startIndex, rng, shuffle), smart }
          set({
            contextLabel: options.context ?? '',
            contextPlaylistId: options.playlistId ?? null,
            consecutiveErrors: 0,
            smartLoading: false,
          })
          loadIndex(queue, queue.index, true)
          if (smart) fillSmart()
        },

        addToQueue(track) {
          const wasEmpty = get().queue.index === -1
          const queue = addToEnd(get().queue, [track])
          if (wasEmpty) loadIndex(queue, 0, true)
          else set({ queue })
        },

        playNext(track) {
          const wasEmpty = get().queue.index === -1
          const queue = insertNext(get().queue, track)
          if (wasEmpty) loadIndex(queue, 0, true)
          else set({ queue })
        },

        removeFromQueue(uid) {
          const { queue, removedCurrent } = removeItem(get().queue, uid)
          if (queue.items.length === 0) {
            get().clearQueue()
            return
          }
          if (removedCurrent) loadIndex(queue, queue.index, get().wantsToPlay)
          else set({ queue })
        },

        moveInQueue(from, to) {
          set({ queue: moveItem(get().queue, from, to) })
        },

        jumpTo(index) {
          loadIndex(get().queue, index, true)
        },

        clearQueue() {
          clearTimeout(skipTimer)
          smartAbort?.abort()
          set({
            queue: { ...emptyQueue, shuffle: get().queue.shuffle, smart: false, repeat: get().queue.repeat },
            contextPlaylistId: null,
            smartLoading: false,
            status: 'idle',
            currentTime: 0,
            duration: 0,
            error: null,
            wantsToPlay: false,
            loadRequest: null,
            contextLabel: '',
          })
        },

        play() {
          const { queue, loadedUid, currentTime } = get()
          const item = currentItem(queue)
          if (!item) return
          if (!isOnline()) {
            set({ status: 'error', error: { code: 'offline', track: item.track }, wantsToPlay: false })
            return
          }
          if (loadedUid !== item.uid || get().status === 'error') {
            // Es. sessione ripristinata: il player non ha ancora questo brano.
            loadIndex(queue, queue.index, true, get().status === 'error' ? 0 : currentTime)
            return
          }
          set({ wantsToPlay: true, floatingCollapsed: false, error: null })
        },

        pause() {
          set({ wantsToPlay: false })
        },

        togglePlay() {
          if (get().wantsToPlay) get().pause()
          else get().play()
        },

        next() {
          const q = get().queue
          const i = nextIndex(q, false)
          if (i === null) {
            // Fine coda: torna all'inizio, fermo.
            if (q.items.length > 0) loadIndex(q, 0, false)
            return
          }
          loadIndex(q, i, true)
        },

        previous() {
          const { queue, currentTime } = get()
          if (currentTime > RESTART_THRESHOLD_SEC) {
            get().seek(0)
            return
          }
          loadIndex(queue, previousIndex(queue), true)
        },

        seek(time) {
          token += 1
          const t = Math.max(0, get().duration > 0 ? Math.min(time, get().duration) : time)
          set({ seekRequest: { time: t, token }, currentTime: t })
        },

        setVolume(volume) {
          set({ volume: Math.min(100, Math.max(0, Math.round(volume))), muted: volume <= 0 })
        },

        toggleMute() {
          set({ muted: !get().muted })
        },

        toggleShuffle() {
          const q = get().queue
          if (q.smart) {
            smartAbort?.abort()
            set({ queue: { ...toggleShuffle(removeRecommended(q), rng), smart: false }, smartLoading: false })
            return
          }
          set({ queue: toggleShuffle(q, rng) })
        },

        cycleShuffle() {
          const q = get().queue
          if (!q.shuffle) {
            set({ queue: toggleShuffle(q, rng) })
          } else if (!q.smart) {
            set({ queue: { ...q, smart: true } })
            fillSmart()
          } else {
            get().toggleShuffle()
          }
        },

        cycleRepeat() {
          set({ queue: cycleRepeat(get().queue) })
        },

        setFloatingCollapsed(collapsed) {
          // Policy YouTube: un player che riproduce dev'essere visibile.
          // Ridurlo significa metterlo in pausa.
          set({ floatingCollapsed: collapsed, ...(collapsed ? { wantsToPlay: false } : {}) })
        },

        dismissError() {
          set({ error: null, status: get().status === 'error' ? 'paused' : get().status })
        },

        _loaded(uid) {
          set({ loadedUid: uid })
        },

        _onStatus(status) {
          switch (status) {
            case 'playing':
              set({ status: 'playing', wantsToPlay: true, needsUserGesture: false, error: null, consecutiveErrors: 0 })
              return
            case 'paused':
              set({ status: 'paused', wantsToPlay: false })
              return
            case 'buffering':
              set({ status: 'buffering' })
              return
            case 'cued':
            case 'unstarted':
              if (get().status !== 'loading') set({ status: 'paused' })
          }
        },

        _onProgress(time, duration) {
          set({ currentTime: time, ...(duration > 0 ? { duration } : {}) })
        },

        _onEnded() {
          const q = get().queue
          // Schermo spento / app in background: YouTube non può suonare lì,
          // quindi si passa direttamente al prossimo brano Audius.
          const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
          const i = hidden ? nextBackgroundIndex(q) : nextIndex(q, true)
          if (i === null) {
            set({ status: 'ended', wantsToPlay: false })
            return
          }
          loadIndex(q, i, true)
        },

        _onError(code) {
          const item = currentItem(get().queue)
          const errors = get().consecutiveErrors + 1
          set({
            status: 'error',
            wantsToPlay: false,
            error: { code, track: item?.track ?? null },
            consecutiveErrors: errors,
          })
          // Video non disponibile o non incorporabile: si passa al successivo,
          // ma senza ciclare all'infinito su una coda di video tutti in errore.
          if (willAutoSkip(get())) {
            const next = nextIndex(get().queue, false)
            clearTimeout(skipTimer)
            skipTimer = setTimeout(() => {
              if (next !== null) loadIndex(get().queue, next, true)
            }, AUTO_SKIP_DELAY_MS)
          }
        },

        _onAutoplayBlocked() {
          set({ needsUserGesture: true, status: 'paused', wantsToPlay: false, floatingCollapsed: false })
        },
      }
    },
    {
      // v2: brani multi-fonte e Smart Shuffle.
      name: 'unitune.player.v2',
      storage: createJSONStorage(() => localStorage),
      // Si salva la sessione (coda, posizione, volume), non lo stato "vivo".
      partialize: (s) => ({
        queue: s.queue,
        contextLabel: s.contextLabel,
        contextPlaylistId: s.contextPlaylistId,
        currentTime: s.currentTime,
        duration: s.duration,
        volume: s.volume,
        muted: s.muted,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.queue.index >= 0) state.status = 'paused'
      },
    },
  ),
)

export function useCurrentTrack(): Track | undefined {
  return usePlayerStore((s) => s.queue.items[s.queue.index]?.track)
}
