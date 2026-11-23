/**
 * Contratto tra il client (PWA) e la Edge Function `youtube`.
 * Unica fonte di verità: importato sia dal frontend sia dalla funzione.
 */

/**
 * Fonti musicali supportate:
 * - youtube: riproduzione SOLO col player IFrame ufficiale (visibile, primo piano);
 * - audius:  catalogo aperto con API pubblica che consente lo streaming audio,
 *            quindi anche in background e con i controlli della schermata di blocco.
 */
export type TrackSource = 'youtube' | 'audius'

/** Metadati di un brano (nessun file audio: solo informazioni pubbliche). */
export interface TrackDTO {
  source: TrackSource
  /** ID nella fonte: ID video YouTube (11 caratteri) o ID traccia Audius. */
  id: string
  title: string
  /** Canale YouTube o nome dell'artista su Audius. */
  channelTitle: string
  thumbnailUrl: string
  /** Durata in secondi; null se non nota. */
  durationSec: number | null
  /** Pagina del brano sulla fonte originale (attribuzione). */
  externalUrl: string
  /** Genere musicale, se la fonte lo fornisce (Audius). */
  genre?: string
}

/** Chiave univoca di un brano tra tutte le fonti. */
export function trackKey(track: Pick<TrackDTO, 'source' | 'id'>): string {
  return `${track.source}:${track.id}`
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export interface SearchRequest {
  op: 'search'
  q: string
  pageToken?: string
}

export interface SearchResponse {
  items: TrackDTO[]
  nextPageToken: string | null
  /** true se la risposta arriva dalla cache (nessuna quota consumata). */
  cached: boolean
}

export type ApiErrorCode =
  /** Quota giornaliera del progetto Google esaurita. */
  | 'quota_exceeded'
  /** Tetto giornaliero di ricerche per utente raggiunto. */
  | 'user_quota_exceeded'
  /** Troppe richieste in poco tempo. */
  | 'rate_limited'
  | 'unauthorized'
  | 'bad_request'
  /** YOUTUBE_API_KEY mancante sul server. */
  | 'not_configured'
  /** Errore della YouTube Data API o di rete lato server. */
  | 'upstream_error'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Secondi dopo i quali ha senso riprovare (es. reset quota). */
    retryAfterSec?: number
  }
}

export const SEARCH_QUERY_MAX_LENGTH = 100
