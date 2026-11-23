/**
 * Contratto tra il client (PWA) e la Edge Function `youtube`.
 * Unica fonte di verità: importato sia dal frontend sia dalla funzione.
 */

/** Metadati di un video musicale, come restituiti dalla YouTube Data API v3. */
export interface TrackDTO {
  /** ID video YouTube (11 caratteri). */
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  /** Durata in secondi; null se non nota. */
  durationSec: number | null
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
