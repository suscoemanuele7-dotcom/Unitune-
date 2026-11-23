/**
 * Wrapper tipizzato sulla YouTube IFrame Player API.
 *
 * ┌─ PERCHÉ L'IFRAME API E NIENT'ALTRO ─────────────────────────────────────┐
 * │ I Termini di Servizio di YouTube e le YouTube API Services Developer     │
 * │ Policies consentono di riprodurre i contenuti in un'app di terzi SOLO   │
 * │ tramite il player incorporato ufficiale. Sono vietati: scaricare o      │
 * │ estrarre gli stream, riprodurli con un <audio>/<video> proprio,         │
 * │ transcodificarli, separare l'audio dal video, passare da proxy.         │
 * │                                                                         │
 * │ Per questo:                                                             │
 * │ - il player è un <iframe> di youtube.com creato da questa API;          │
 * │ - è SEMPRE visibile e almeno 200×200 px mentre riproduce (requisito     │
 * │   minimo delle policy): niente player nascosti/1px per "solo audio";   │
 * │ - non copriamo il player né i suoi controlli con altri elementi;        │
 * │ - comandiamo il player solo tramite i metodi pubblici dell'API.         │
 * │ Limite conseguente: in background / schermo bloccato la riproduzione   │
 * │ dipende dal browser e di norma si ferma. Non lo aggiriamo.              │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
import { YTState, type YTNamespace, type YTPlayerInstance } from './ytTypes'

export type PlayerStateName = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued'

/**
 * Errori del player, dai codici documentati dell'evento onError:
 *   2   parametro non valido (es. ID malformato)
 *   5   errore del player HTML5
 *   100 video non trovato, rimosso o privato
 *   101, 150  il proprietario non consente l'incorporamento
 *   153 richiesta del player senza referrer/identità valida (configurazione)
 */
export type PlayerErrorCode =
  | 'invalid_param'
  | 'html5'
  | 'not_found'
  | 'embed_disabled'
  | 'embed_config'
  | 'api_load_failed'
  | 'unknown'

export function mapPlayerError(code: number): PlayerErrorCode {
  switch (code) {
    case 2:
      return 'invalid_param'
    case 5:
      return 'html5'
    case 100:
      return 'not_found'
    case 101:
    case 150:
      return 'embed_disabled'
    case 153:
      return 'embed_config'
    default:
      return 'unknown'
  }
}

function mapState(state: number): PlayerStateName {
  switch (state) {
    case YTState.ENDED:
      return 'ended'
    case YTState.PLAYING:
      return 'playing'
    case YTState.PAUSED:
      return 'paused'
    case YTState.BUFFERING:
      return 'buffering'
    case YTState.CUED:
      return 'cued'
    default:
      return 'unstarted'
  }
}

export interface PlayerListeners {
  onStateChange: (state: PlayerStateName) => void
  onError: (code: PlayerErrorCode) => void
  /** Il browser ha bloccato l'avvio automatico: serve un tocco sul player. */
  onAutoplayBlocked: () => void
}

const API_SRC = 'https://www.youtube.com/iframe_api'
const API_TIMEOUT_MS = 15_000
let apiPromise: Promise<YTNamespace> | null = null

/**
 * Carica lo script ufficiale dell'IFrame API una sola volta, al primo play
 * (non all'avvio: nessuna richiesta a YouTube finché l'utente non ascolta).
 */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const fail = (reason: string) => {
      apiPromise = null // permette un nuovo tentativo (es. tornata la rete)
      script.remove()
      reject(new Error(reason))
    }
    const timer = setTimeout(() => {
      fail('Timeout nel caricamento della YouTube IFrame API')
    }, API_TIMEOUT_MS)

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer)
      previous?.()
      if (window.YT) resolve(window.YT)
      else fail('YouTube IFrame API non disponibile')
    }

    const script = document.createElement('script')
    script.src = API_SRC
    script.async = true
    script.onerror = () => {
      clearTimeout(timer)
      fail('Impossibile caricare la YouTube IFrame API (rete assente o bloccata)')
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

export class YouTubePlayer {
  private readonly player: YTPlayerInstance

  private constructor(player: YTPlayerInstance) {
    this.player = player
  }

  /** Crea il player dentro `container` (che viene sostituito dall'iframe). */
  static async create(container: HTMLElement, listeners: PlayerListeners): Promise<YouTubePlayer> {
    const YT = await loadYouTubeApi()
    return new Promise<YouTubePlayer>((resolve) => {
      const instance = new YT.Player(container, {
        width: '100%',
        height: '100%',
        playerVars: {
          // Riproduzione inline su iOS (niente fullscreen forzato).
          playsinline: 1,
          // Controlli nativi di YouTube visibili: non li nascondiamo.
          controls: 1,
          // Video correlati solo dello stesso canale a fine riproduzione.
          rel: 0,
          // Il fullscreen è la nostra schermata del player.
          fs: 0,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            resolve(wrapper)
          },
          onStateChange: (e) => {
            listeners.onStateChange(mapState(e.data))
          },
          onError: (e) => {
            listeners.onError(mapPlayerError(e.data))
          },
          onAutoplayBlocked: () => {
            listeners.onAutoplayBlocked()
          },
        },
      })
      const wrapper = new YouTubePlayer(instance)
    })
  }

  /** Carica e AVVIA un video. */
  loadVideoById(videoId: string, startSeconds = 0): void {
    this.player.loadVideoById(videoId, startSeconds)
  }

  /** Carica un video SENZA avviarlo (es. ripristino ultima sessione). */
  cueVideoById(videoId: string, startSeconds = 0): void {
    this.player.cueVideoById(videoId, startSeconds)
  }

  playVideo(): void {
    this.player.playVideo()
  }

  pauseVideo(): void {
    this.player.pauseVideo()
  }

  seekTo(seconds: number): void {
    this.player.seekTo(Math.max(0, seconds), true)
  }

  getCurrentTime(): number {
    return this.player.getCurrentTime()
  }

  getDuration(): number {
    return this.player.getDuration()
  }

  /**
   * Volume 0–100. Nota: su iOS il volume è controllato solo dai tasti fisici
   * e il player ignora setVolume; l'interfaccia nasconde lo slider lì.
   */
  setVolume(volume: number): void {
    this.player.setVolume(Math.round(Math.min(100, Math.max(0, volume))))
  }

  setMuted(muted: boolean): void {
    if (muted) this.player.mute()
    else this.player.unMute()
  }

  destroy(): void {
    this.player.destroy()
  }
}

/** iOS/iPadOS: volume non controllabile via JavaScript. */
export function supportsVolumeControl(): boolean {
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  return !iOS
}
