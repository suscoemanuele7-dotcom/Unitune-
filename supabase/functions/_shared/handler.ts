/**
 * Handler HTTP della Edge Function `youtube`, scritto contro le sole API Web
 * standard (Request/Response/fetch) e con dipendenze iniettate: così è
 * testabile con Vitest senza il runtime Deno.
 *
 * Perché un proxy dei METADATI lato server (e non la chiave nel browser):
 * - la API key resta segreta (secret della funzione);
 * - la cache condivisa fa risparmiare quota (search.list costa 100 unità);
 * - un tetto di ricerche per utente protegge la quota del progetto.
 * Questo NON è un proxy audio: inoltra solo chiamate search/videos della
 * Data API ufficiale. Nessuno stream passa da qui.
 */
import {
  SEARCH_QUERY_MAX_LENGTH,
  type ApiErrorBody,
  type ApiErrorCode,
  type SearchResponse,
  type TrackDTO,
} from './contract.ts'
import {
  buildSearchUrl,
  buildVideosUrl,
  mapGoogleError,
  normalizeQuery,
  parseSearchResponse,
  parseVideosResponse,
  secondsUntilQuotaReset,
} from './youtube-core.ts'

export interface CachedSearch {
  items: TrackDTO[]
  nextPageToken: string | null
}

export interface HandlerDeps {
  apiKey: string | undefined
  fetch: typeof fetch
  /** Restituisce l'ID utente dal header Authorization, o null se non valido. */
  authenticate(authorization: string): Promise<string | null>
  /** Consuma una ricerca dal tetto giornaliero dell'utente. false = tetto raggiunto. */
  consumeUserQuota(userId: string): Promise<boolean>
  cache: {
    get(key: string): Promise<CachedSearch | null>
    set(key: string, value: CachedSearch, ttlSec: number): Promise<void>
  }
  allowedOrigins: readonly string[]
  regionCode: string
  relevanceLanguage: string
  cacheTtlSec: number
  now(): Date
  log(message: string, error?: unknown): void
}

function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (allowed.includes('*')) headers['Access-Control-Allow-Origin'] = '*'
  else if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const cors = corsHeaders(request.headers.get('origin'), deps.allowedOrigins)

    const json = (status: number, body: SearchResponse | ApiErrorBody, extra: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', ...extra },
      })
    const fail = (status: number, code: ApiErrorCode, message: string, retryAfterSec?: number) =>
      json(
        status,
        { error: { code, message, ...(retryAfterSec !== undefined ? { retryAfterSec } : {}) } },
        retryAfterSec !== undefined ? { 'Retry-After': String(retryAfterSec) } : {},
      )

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return fail(405, 'bad_request', 'Metodo non consentito.')

    // ── Autenticazione: solo utenti loggati consumano quota ──
    const authorization = request.headers.get('authorization') ?? ''
    const userId = authorization ? await deps.authenticate(authorization) : null
    if (!userId) return fail(401, 'unauthorized', 'Sessione non valida: effettua di nuovo il login.')

    // ── Validazione input ──
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail(400, 'bad_request', 'Corpo della richiesta non valido.')
    }
    if (!isRecord(body) || body.op !== 'search' || typeof body.q !== 'string') {
      return fail(400, 'bad_request', 'Richiesta non valida.')
    }
    const query = normalizeQuery(body.q)
    if (query.length === 0 || query.length > SEARCH_QUERY_MAX_LENGTH) {
      return fail(400, 'bad_request', `La ricerca deve avere tra 1 e ${SEARCH_QUERY_MAX_LENGTH} caratteri.`)
    }
    const pageToken = typeof body.pageToken === 'string' && body.pageToken.length <= 200 ? body.pageToken : undefined

    if (!deps.apiKey) {
      return fail(503, 'not_configured', 'YOUTUBE_API_KEY non configurata sul server.')
    }

    // ── Cache condivisa (non consuma né quota Google né tetto utente) ──
    const cacheKey = `search:v2:${deps.regionCode}:${query}:${pageToken ?? ''}`
    try {
      const hit = await deps.cache.get(cacheKey)
      if (hit) return json(200, { ...hit, cached: true })
    } catch (error) {
      deps.log('Lettura cache fallita (continuo senza cache)', error)
    }

    // ── Tetto per utente ──
    let allowed: boolean
    try {
      allowed = await deps.consumeUserQuota(userId)
    } catch (error) {
      deps.log('Controllo tetto utente fallito', error)
      return fail(502, 'upstream_error', 'Servizio temporaneamente non disponibile.')
    }
    if (!allowed) {
      return fail(
        429,
        'user_quota_exceeded',
        'Hai raggiunto il numero massimo di ricerche per oggi.',
        secondsUntilQuotaReset(deps.now()),
      )
    }

    // ── YouTube Data API v3: search.list + videos.list ──
    const callGoogle = async (url: string): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> => {
      let res: Response
      try {
        res = await deps.fetch(url, { headers: { Accept: 'application/json' } })
      } catch (error) {
        deps.log('Rete verso YouTube Data API non raggiungibile', error)
        return { ok: false, response: fail(502, 'upstream_error', 'YouTube non raggiungibile dal server.') }
      }
      let parsed: unknown
      try {
        parsed = await res.json()
      } catch {
        parsed = null
      }
      if (!res.ok) {
        const mapped = mapGoogleError(res.status, parsed)
        deps.log(`YouTube Data API ${res.status}: ${mapped.code}`)
        const retry = mapped.code === 'quota_exceeded' ? secondsUntilQuotaReset(deps.now()) : undefined
        return { ok: false, response: fail(mapped.status, mapped.code, mapped.message, retry) }
      }
      return { ok: true, body: parsed }
    }

    const search = await callGoogle(
      buildSearchUrl({
        query,
        pageToken,
        apiKey: deps.apiKey,
        regionCode: deps.regionCode,
        relevanceLanguage: deps.relevanceLanguage,
        maxResults: 20,
      }),
    )
    if (!search.ok) return search.response
    const { videoIds, nextPageToken } = parseSearchResponse(search.body)

    let items: TrackDTO[] = []
    if (videoIds.length > 0) {
      const videos = await callGoogle(buildVideosUrl(videoIds, deps.apiKey))
      if (!videos.ok) return videos.response
      items = parseVideosResponse(videos.body, videoIds)
    }

    const result: CachedSearch = { items, nextPageToken }
    try {
      await deps.cache.set(cacheKey, result, deps.cacheTtlSec)
    } catch (error) {
      deps.log('Scrittura cache fallita', error)
    }
    return json(200, { ...result, cached: false })
  }
}
