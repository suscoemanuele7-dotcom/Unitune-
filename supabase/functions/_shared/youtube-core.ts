/**
 * Logica pura di accesso alla YouTube Data API v3 (nessuna dipendenza da
 * Deno o Node: testabile ovunque).
 *
 * Usiamo SOLO due endpoint ufficiali:
 * - search.list (100 unità di quota): trova gli ID dei video musicali;
 * - videos.list (1 unità): durata e stato di "embeddabilità".
 * Non c'è nessuno scraping né accesso agli stream: la riproduzione avviene
 * nel client esclusivamente tramite il player IFrame ufficiale.
 */
import type { ApiErrorCode, TrackDTO } from './contract.ts'

const API_BASE = 'https://www.googleapis.com/youtube/v3'

export interface SearchParams {
  query: string
  pageToken?: string | undefined
  apiKey: string
  regionCode: string
  relevanceLanguage: string
  maxResults: number
}

export function buildSearchUrl(p: SearchParams): string {
  const url = new URL(`${API_BASE}/search`)
  const params: Record<string, string> = {
    part: 'snippet',
    type: 'video',
    // Categoria 10 = "Music".
    videoCategoryId: '10',
    // Filtri ufficiali: solo video che il creator permette di incorporare e
    // riprodurre fuori da youtube.com. Riduce gli errori 101/150 nel player.
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    safeSearch: 'moderate',
    maxResults: String(p.maxResults),
    q: p.query,
    regionCode: p.regionCode,
    relevanceLanguage: p.relevanceLanguage,
    // `fields` riduce il payload (la quota resta 100 unità).
    fields: 'nextPageToken,items(id/videoId)',
    key: p.apiKey,
  }
  if (p.pageToken) params.pageToken = p.pageToken
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}

export function buildVideosUrl(ids: readonly string[], apiKey: string): string {
  const url = new URL(`${API_BASE}/videos`)
  url.searchParams.set('part', 'snippet,contentDetails,status')
  url.searchParams.set('id', ids.join(','))
  url.searchParams.set(
    'fields',
    'items(id,snippet(title,channelTitle,thumbnails),contentDetails/duration,status(embeddable,privacyStatus))',
  )
  url.searchParams.set('key', apiKey)
  return url.toString()
}

/** "PT1H2M3S" → 3723. Restituisce null se il formato non è riconosciuto. */
export function parseIsoDuration(iso: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso)
  if (!m || iso === 'P' || iso === 'PT') return null
  const [, d, h, min, s] = m
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
}

/** La Data API restituisce titoli con entità HTML (&amp;, &#39;, …). */
export function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) return String.fromCodePoint(parseInt(entity.slice(2), 16))
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10))
    return named[entity.toLowerCase()] ?? match
  })
}

// ── Parsing difensivo delle risposte (i dati esterni sono `unknown`) ─────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

export interface ParsedSearch {
  videoIds: string[]
  nextPageToken: string | null
}

export function parseSearchResponse(body: unknown): ParsedSearch {
  if (!isRecord(body)) return { videoIds: [], nextPageToken: null }
  const items = Array.isArray(body.items) ? body.items : []
  const videoIds: string[] = []
  for (const item of items) {
    if (!isRecord(item) || !isRecord(item.id)) continue
    const id = str(item.id.videoId)
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id) && !videoIds.includes(id)) videoIds.push(id)
  }
  return { videoIds, nextPageToken: str(body.nextPageToken) ?? null }
}

function pickThumbnail(thumbnails: unknown, videoId: string): string {
  if (isRecord(thumbnails)) {
    for (const size of ['high', 'medium', 'standard', 'default'] as const) {
      const t = thumbnails[size]
      if (isRecord(t)) {
        const u = str(t.url)
        if (u) return u
      }
    }
  }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * Converte la risposta di videos.list in TrackDTO, mantenendo l'ordine di
 * rilevanza della ricerca e scartando i video non incorporabili o privati.
 */
export function parseVideosResponse(body: unknown, order: readonly string[]): TrackDTO[] {
  if (!isRecord(body) || !Array.isArray(body.items)) return []
  const byId = new Map<string, TrackDTO>()
  for (const item of body.items) {
    if (!isRecord(item)) continue
    const id = str(item.id)
    const snippet = isRecord(item.snippet) ? item.snippet : undefined
    const status = isRecord(item.status) ? item.status : undefined
    const details = isRecord(item.contentDetails) ? item.contentDetails : undefined
    if (!id || !snippet) continue
    if (status?.embeddable === false) continue
    const privacy = str(status?.privacyStatus)
    if (privacy && privacy !== 'public' && privacy !== 'unlisted') continue
    const duration = str(details?.duration)
    byId.set(id, {
      videoId: id,
      title: decodeHtmlEntities(str(snippet.title) ?? ''),
      channelTitle: decodeHtmlEntities(str(snippet.channelTitle) ?? ''),
      thumbnailUrl: pickThumbnail(snippet.thumbnails, id),
      durationSec: duration ? parseIsoDuration(duration) : null,
    })
  }
  return order.flatMap((id) => {
    const track = byId.get(id)
    return track ? [track] : []
  })
}

export interface MappedGoogleError {
  status: number
  code: ApiErrorCode
  message: string
}

/**
 * Traduce un errore della Google API in un errore del nostro contratto.
 * Formato Google: { error: { code, message, errors: [{ reason }] } }
 */
export function mapGoogleError(httpStatus: number, body: unknown): MappedGoogleError {
  let reason = ''
  if (isRecord(body) && isRecord(body.error)) {
    const errors = body.error.errors
    if (Array.isArray(errors) && isRecord(errors[0])) reason = str(errors[0].reason) ?? ''
  }
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    return { status: 503, code: 'quota_exceeded', message: 'Quota giornaliera YouTube esaurita.' }
  }
  if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded' || httpStatus === 429) {
    return { status: 429, code: 'rate_limited', message: 'Troppe richieste a YouTube, riprova tra poco.' }
  }
  if (reason === 'keyInvalid') {
    return { status: 502, code: 'upstream_error', message: 'La YOUTUBE_API_KEY configurata non è valida.' }
  }
  if (httpStatus === 400) {
    return { status: 400, code: 'bad_request', message: 'Richiesta non valida.' }
  }
  // keyInvalid, ipRefererBlocked, accessNotConfigured, forbidden, 5xx…
  return {
    status: 502,
    code: 'upstream_error',
    message: reason ? `Errore YouTube Data API (${reason}).` : `Errore YouTube Data API (HTTP ${httpStatus}).`,
  }
}

/**
 * La quota della YouTube Data API si azzera a mezzanotte, ora del Pacifico.
 * Restituisce i secondi mancanti al prossimo reset.
 */
export function secondsUntilQuotaReset(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const elapsed = get('hour') * 3600 + get('minute') * 60 + get('second')
  return Math.max(60, 86400 - elapsed)
}

export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ').toLowerCase()
}
