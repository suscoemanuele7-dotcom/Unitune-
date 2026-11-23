/**
 * Client per la ricerca di brani (YouTube Data API v3).
 *
 * Il browser NON chiama direttamente googleapis.com: passa dalla nostra
 * Supabase Edge Function `youtube`, che custodisce la API key, applica una
 * cache condivisa e un tetto per utente (vedi supabase/functions).
 *
 * Qui gestiamo, lato client:
 * - errori tipizzati (quota, rete assente, sessione scaduta, …);
 * - una cache in memoria per non ripetere ricerche identiche;
 * - un intervallo minimo tra le ricerche (rispetto della quota);
 * - un "periodo di attesa" dopo una quota esaurita, fino al reset: evitiamo
 *   di inviare richieste che fallirebbero comunque.
 */
import type { ApiErrorCode, SearchResponse } from '../../supabase/functions/_shared/contract.ts'
import { SEARCH_QUERY_MAX_LENGTH } from '../../supabase/functions/_shared/contract.ts'
import type { Track } from '../types'
import { isRecord } from '../lib/storage'
import { demoCatalog } from './fixtures'

export type YouTubeErrorCode = ApiErrorCode | 'offline' | 'network' | 'aborted'

export class YouTubeApiError extends Error {
  readonly code: YouTubeErrorCode
  /** Secondi dopo cui riprovare, se noti. */
  readonly retryAfterSec: number | undefined

  constructor(code: YouTubeErrorCode, message: string, retryAfterSec?: number) {
    super(message)
    this.name = 'YouTubeApiError'
    this.code = code
    this.retryAfterSec = retryAfterSec
  }
}

export interface SearchResult {
  items: Track[]
  nextPageToken: string | null
}

export interface SearchOptions {
  pageToken?: string | null
  signal?: AbortSignal
}

export interface YouTubeClient {
  /** true se i risultati sono dimostrativi e non consumano quota. */
  readonly isMock: boolean
  search(query: string, options?: SearchOptions): Promise<SearchResult>
}

export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ').toLowerCase()
}

// ─────────────────────────────────────────────────────────────────────────
// Client reale (via Edge Function)
// ─────────────────────────────────────────────────────────────────────────

export interface EdgeClientDeps {
  functionUrl: string
  anonKey: string
  getAccessToken: () => Promise<string | null>
  fetch: typeof fetch
  now(): number
  isOnline: () => boolean
  /** Dove ricordare il periodo di attesa dopo una quota esaurita. */
  cooldownStore: { get(): CooldownState | null; set: (value: CooldownState | null) => void }
  minIntervalMs?: number
  cacheTtlMs?: number
}

export interface CooldownState {
  code: 'quota_exceeded' | 'user_quota_exceeded'
  until: number
}

const QUOTA_CODES: ReadonlySet<YouTubeErrorCode> = new Set(['quota_exceeded', 'user_quota_exceeded'])

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new YouTubeApiError('aborted', 'Ricerca annullata'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new YouTubeApiError('aborted', 'Ricerca annullata'))
      },
      { once: true },
    )
  })
}

function parseErrorBody(body: unknown): { code: ApiErrorCode; message: string; retryAfterSec?: number } | null {
  if (!isRecord(body) || !isRecord(body.error)) return null
  const { code, message, retryAfterSec } = body.error
  if (typeof code !== 'string' || typeof message !== 'string') return null
  return {
    code: code as ApiErrorCode,
    message,
    ...(typeof retryAfterSec === 'number' ? { retryAfterSec } : {}),
  }
}

function isSearchResponse(body: unknown): body is SearchResponse {
  return isRecord(body) && Array.isArray(body.items)
}

export class EdgeFunctionYouTubeClient implements YouTubeClient {
  readonly isMock = false
  private readonly cache = new Map<string, { at: number; result: SearchResult }>()
  private lastRequestAt = 0
  private readonly deps: EdgeClientDeps

  constructor(deps: EdgeClientDeps) {
    this.deps = deps
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const { signal } = options
    const q = normalizeQuery(query)
    if (q.length === 0) return { items: [], nextPageToken: null }
    if (q.length > SEARCH_QUERY_MAX_LENGTH) {
      throw new YouTubeApiError('bad_request', `Massimo ${SEARCH_QUERY_MAX_LENGTH} caratteri.`)
    }

    const key = `${q}\u0000${options.pageToken ?? ''}`
    const ttl = this.deps.cacheTtlMs ?? 10 * 60_000
    const hit = this.cache.get(key)
    if (hit && this.deps.now() - hit.at < ttl) return hit.result

    // Quota esaurita di recente: non insistiamo fino al reset.
    const cooldown = this.deps.cooldownStore.get()
    if (cooldown) {
      const remainingMs = cooldown.until - this.deps.now()
      if (remainingMs > 0) {
        throw new YouTubeApiError(cooldown.code, 'Quota esaurita', Math.ceil(remainingMs / 1000))
      }
      this.deps.cooldownStore.set(null)
    }

    if (!this.deps.isOnline()) throw new YouTubeApiError('offline', 'Sei offline')

    // Intervallo minimo tra due richieste di rete.
    const minInterval = this.deps.minIntervalMs ?? 800
    const wait = this.lastRequestAt + minInterval - this.deps.now()
    if (wait > 0) await sleep(wait, signal)
    this.lastRequestAt = this.deps.now()

    const token = await this.deps.getAccessToken()
    if (!token) throw new YouTubeApiError('unauthorized', 'Sessione scaduta')

    let response: Response
    try {
      response = await this.deps.fetch(this.deps.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.deps.anonKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ op: 'search', q, ...(options.pageToken ? { pageToken: options.pageToken } : {}) }),
        ...(signal ? { signal } : {}),
      })
    } catch (error) {
      if (signal?.aborted) throw new YouTubeApiError('aborted', 'Ricerca annullata')
      if (!this.deps.isOnline()) throw new YouTubeApiError('offline', 'Sei offline')
      throw new YouTubeApiError('network', error instanceof Error ? error.message : 'Errore di rete')
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = null
    }

    if (!response.ok) {
      const parsed = parseErrorBody(body)
      const code: YouTubeErrorCode =
        parsed?.code ?? (response.status === 401 ? 'unauthorized' : response.status === 429 ? 'rate_limited' : 'upstream_error')
      const retry = parsed?.retryAfterSec ?? (Number(response.headers.get('retry-after')) || undefined)
      if ((code === 'quota_exceeded' || code === 'user_quota_exceeded') && retry !== undefined) {
        this.deps.cooldownStore.set({ code, until: this.deps.now() + retry * 1000 })
      }
      throw new YouTubeApiError(code, parsed?.message ?? `HTTP ${response.status}`, retry)
    }

    if (!isSearchResponse(body)) throw new YouTubeApiError('upstream_error', 'Risposta non valida dal server')
    const result: SearchResult = { items: body.items, nextPageToken: body.nextPageToken }
    this.cache.set(key, { at: this.deps.now(), result })
    if (this.cache.size > 50) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
    return result
  }
}

export function isQuotaError(error: unknown): boolean {
  return error instanceof YouTubeApiError && QUOTA_CODES.has(error.code)
}

// ─────────────────────────────────────────────────────────────────────────
// Client dimostrativo (nessuna rete, nessuna quota)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cerca nel catalogo dimostrativo. Query speciali per provare la UI degli
 * errori: "!quota", "!rete", "!offline", "!errore".
 */
export class MockYouTubeClient implements YouTubeClient {
  readonly isMock = true
  private readonly latencyMs: number

  constructor(latencyMs = 350) {
    this.latencyMs = latencyMs
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    await sleep(this.latencyMs, options.signal)
    const q = normalizeQuery(query)
    switch (q) {
      case '!quota':
        throw new YouTubeApiError('quota_exceeded', 'Quota esaurita (simulata)', 3 * 3600)
      case '!rete':
        throw new YouTubeApiError('network', 'Errore di rete (simulato)')
      case '!offline':
        throw new YouTubeApiError('offline', 'Offline (simulato)')
      case '!errore':
        throw new YouTubeApiError('upstream_error', 'Errore del server (simulato)')
    }
    if (q.length === 0) return { items: [], nextPageToken: null }
    const words = q.split(' ')
    const items = demoCatalog.filter((track) => {
      const haystack = `${track.title} ${track.channelTitle}`.toLowerCase()
      return words.every((w) => haystack.includes(w))
    })
    return { items, nextPageToken: null }
  }
}
