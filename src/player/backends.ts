/**
 * Motori di riproduzione. Il motore giusto dipende dalla FONTE del brano:
 *
 * - YouTubeBackend: SOLO il player IFrame ufficiale (vedi YouTubePlayer.ts),
 *   sempre visibile mentre suona. Niente background.
 * - AudioBackend: un elemento <audio> per i brani Audius, la cui API
 *   pubblica consente lo streaming audio. Continua a suonare a schermo
 *   spento e integra davvero la Media Session (schermata di blocco).
 */
import type { Track, TrackSource } from '../types'
import { YouTubePlayer, type PlayerErrorCode, type PlayerListeners } from './YouTubePlayer'

export interface PlaybackBackend {
  readonly source: TrackSource
  load(track: Track, startAt: number, autoplay: boolean): Promise<void>
  play(): void
  pause(): void
  seek(seconds: number): void
  setVolume(volume: number): void
  setMuted(muted: boolean): void
  currentTime(): number
  duration(): number
  destroy(): void
}

// ─────────────────────────────────────────────────────────────────────────

export class YouTubeBackend implements PlaybackBackend {
  readonly source = 'youtube' as const
  private player: YouTubePlayer | null = null
  private creating: Promise<YouTubePlayer> | null = null
  private volume = 100
  private muted = false
  private readonly getContainer: () => HTMLElement | null
  private readonly listeners: PlayerListeners

  constructor(getContainer: () => HTMLElement | null, listeners: PlayerListeners) {
    this.getContainer = getContainer
    this.listeners = listeners
  }

  /** Il player viene creato solo al primo brano YouTube (nessuna richiesta prima). */
  private ensure(): Promise<YouTubePlayer> {
    if (this.player) return Promise.resolve(this.player)
    if (!this.creating) {
      const container = this.getContainer()
      if (!container) return Promise.reject(new Error('Contenitore del player mancante'))
      const mount = document.createElement('div')
      container.appendChild(mount)
      this.creating = YouTubePlayer.create(mount, this.listeners)
        .then((p) => {
          this.player = p
          p.setVolume(this.volume)
          p.setMuted(this.muted)
          return p
        })
        .catch((error: unknown) => {
          this.creating = null
          mount.remove()
          throw error
        })
    }
    return this.creating
  }

  async load(track: Track, startAt: number, autoplay: boolean) {
    const p = await this.ensure()
    if (autoplay) p.loadVideoById(track.id, startAt)
    else p.cueVideoById(track.id, startAt)
  }
  play() {
    this.player?.playVideo()
  }
  pause() {
    this.player?.pauseVideo()
  }
  seek(seconds: number) {
    this.player?.seekTo(seconds)
  }
  setVolume(volume: number) {
    this.volume = volume
    this.player?.setVolume(volume)
  }
  setMuted(muted: boolean) {
    this.muted = muted
    this.player?.setMuted(muted)
  }
  currentTime() {
    return this.player?.getCurrentTime() ?? 0
  }
  duration() {
    return this.player?.getDuration() ?? 0
  }
  destroy() {
    this.player?.destroy()
    this.player = null
  }
}

// ─────────────────────────────────────────────────────────────────────────

function mapMediaError(error: MediaError | null): PlayerErrorCode | 'offline' {
  if (!navigator.onLine) return 'offline'
  switch (error?.code) {
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      // Lo stream non esiste più (brano rimosso) o non è riproducibile.
      return 'not_found'
    default:
      return 'html5'
  }
}

export interface AudioListeners extends Omit<PlayerListeners, 'onError'> {
  onError(code: PlayerErrorCode | 'offline'): void
}

export class AudioBackend implements PlaybackBackend {
  readonly source = 'audius' as const
  private readonly el: HTMLAudioElement
  private readonly listeners: AudioListeners
  private readonly streamUrl: (trackId: string) => string
  /** Durante il caricamento si ignorano i "pause" generati dal cambio di src. */
  private loading = false

  constructor(listeners: AudioListeners, streamUrl: (trackId: string) => string) {
    this.listeners = listeners
    this.streamUrl = streamUrl
    const el = new Audio()
    el.preload = 'auto'
    el.setAttribute('data-unitune-audio', '')
    el.addEventListener('playing', () => {
      this.loading = false
      listeners.onStateChange('playing')
    })
    el.addEventListener('pause', () => {
      if (!this.loading && !el.ended) listeners.onStateChange('paused')
    })
    el.addEventListener('waiting', () => {
      listeners.onStateChange('buffering')
    })
    el.addEventListener('ended', () => {
      listeners.onStateChange('ended')
    })
    el.addEventListener('error', () => {
      this.loading = false
      listeners.onError(mapMediaError(el.error))
    })
    this.el = el
  }

  private async tryPlay() {
    try {
      await this.el.play()
    } catch (error) {
      this.loading = false
      if (error instanceof DOMException && error.name === 'NotAllowedError') this.listeners.onAutoplayBlocked()
      // AbortError: un nuovo load ha interrotto il play precedente, è normale.
      else if (!(error instanceof DOMException && error.name === 'AbortError')) {
        // Gli errori di caricamento arrivano anche dall'evento "error".
      }
    }
  }

  load(track: Track, startAt: number, autoplay: boolean): Promise<void> {
    this.loading = true
    this.el.src = this.streamUrl(track.id)
    if (startAt > 0) {
      this.el.addEventListener(
        'loadedmetadata',
        () => {
          this.el.currentTime = startAt
        },
        { once: true },
      )
    }
    if (autoplay) {
      void this.tryPlay()
    } else {
      this.loading = false
      this.el.load()
      this.listeners.onStateChange('cued')
    }
    return Promise.resolve()
  }
  play() {
    void this.tryPlay()
  }
  pause() {
    this.loading = false
    this.el.pause()
  }
  seek(seconds: number) {
    this.el.currentTime = Math.max(0, seconds)
  }
  setVolume(volume: number) {
    this.el.volume = Math.min(1, Math.max(0, volume / 100))
  }
  setMuted(muted: boolean) {
    this.el.muted = muted
  }
  currentTime() {
    return this.el.currentTime
  }
  duration() {
    return Number.isFinite(this.el.duration) ? this.el.duration : 0
  }
  destroy() {
    this.el.pause()
    this.el.removeAttribute('src')
    this.el.load()
  }
}
