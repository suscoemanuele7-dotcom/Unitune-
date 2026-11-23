/**
 * Client per l'API pubblica di Audius (https://api.audius.co).
 *
 * Perché Audius: è un catalogo musicale aperto la cui API pubblica consente
 * di riprodurre l'audio in streaming nelle app di terzi, senza chiavi.
 * Questi brani si possono quindi ascoltare con un normale <audio>: anche a
 * schermo spento e con i controlli della schermata di blocco, cosa che con
 * YouTube non è permessa.
 *
 * Attribuzione: ogni brano mostra l'artista e il link alla pagina su Audius.
 */
import type { Track } from '../types'
import { isRecord } from '../lib/storage'

export const AUDIUS_API = (import.meta.env.VITE_AUDIUS_API ?? 'https://api.audius.co/v1').replace(/\/+$/, '')
const APP_NAME = import.meta.env.VITE_AUDIUS_APP_NAME ?? 'UniTune'
const PAGE_SIZE = 20

export type AudiusErrorCode = 'offline' | 'network' | 'unavailable' | 'aborted'

export class AudiusApiError extends Error {
  readonly code: AudiusErrorCode
  constructor(code: AudiusErrorCode, message: string) {
    super(message)
    this.name = 'AudiusApiError'
    this.code = code
  }
}

export interface AudiusPage {
  items: Track[]
  /** Offset per la pagina successiva, o null se finita. */
  nextOffset: number | null
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/**
 * Converte una traccia dell'API in Track. Scarta i brani non riproducibili
 * in streaming pubblico (riservati, cancellati, non disponibili).
 */
export function audiusToTrack(raw: unknown): Track | null {
  if (!isRecord(raw)) return null
  const id = str(raw.id)
  const title = str(raw.title)
  if (!id || !/^[A-Za-z0-9]{1,32}$/.test(id) || !title) return null
  if (raw.is_streamable !== true || raw.is_stream_gated === true || raw.is_delete === true || raw.is_available === false) {
    return null
  }
  const access = isRecord(raw.access) ? raw.access : null
  if (access && access.stream === false) return null

  const user = isRecord(raw.user) ? raw.user : {}
  const artwork = isRecord(raw.artwork) ? raw.artwork : {}
  const permalink = str(raw.permalink)
  const genre = str(raw.genre)
  const track: Track = {
    source: 'audius',
    id,
    title,
    channelTitle: str(user.name) ?? str(user.handle) ?? '',
    thumbnailUrl: str(artwork['480x480']) ?? str(artwork['150x150']) ?? str(artwork['1000x1000']) ?? '',
    durationSec: typeof raw.duration === 'number' && raw.duration > 0 ? Math.round(raw.duration) : null,
    externalUrl: permalink ? `https://audius.co${permalink}` : 'https://audius.co',
  }
  if (genre) track.genre = genre
  return track
}

export interface AudiusClientDeps {
  fetch: typeof fetch
  isOnline(): boolean
  baseUrl?: string
}

export class AudiusClient {
  private readonly deps: AudiusClientDeps
  private readonly base: string

  constructor(deps: AudiusClientDeps) {
    this.deps = deps
    this.base = deps.baseUrl ?? AUDIUS_API
  }

  /** URL dello stream audio (l'API risponde con un redirect al file). */
  streamUrl(trackId: string): string {
    return `${this.base}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${encodeURIComponent(APP_NAME)}`
  }

  search(query: string, options: { offset?: number; signal?: AbortSignal } = {}): Promise<AudiusPage> {
    const q = query.trim()
    if (!q) return Promise.resolve({ items: [], nextOffset: null })
    return this.list('/tracks/search', { query: q, limit: String(PAGE_SIZE), offset: String(options.offset ?? 0) }, options)
  }

  /** Brani di tendenza, eventualmente di un genere (es. "Electronic"). */
  trending(options: { genre?: string; signal?: AbortSignal } = {}): Promise<AudiusPage> {
    const params: Record<string, string> = { limit: String(PAGE_SIZE), time: 'week' }
    if (options.genre) params.genre = options.genre
    return this.list('/tracks/trending', params, { ...options, offset: 0, noPaging: true })
  }

  private async list(
    path: string,
    params: Record<string, string>,
    options: { offset?: number; signal?: AbortSignal; noPaging?: boolean },
  ): Promise<AudiusPage> {
    if (!this.deps.isOnline()) throw new AudiusApiError('offline', 'Sei offline')
    const url = new URL(`${this.base}${path}`)
    for (const [k, v] of Object.entries({ ...params, app_name: APP_NAME })) url.searchParams.set(k, v)

    let res: Response
    try {
      res = await this.deps.fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        ...(options.signal ? { signal: options.signal } : {}),
      })
    } catch (error) {
      if (options.signal?.aborted) throw new AudiusApiError('aborted', 'Annullato')
      if (!this.deps.isOnline()) throw new AudiusApiError('offline', 'Sei offline')
      throw new AudiusApiError('network', error instanceof Error ? error.message : 'Errore di rete')
    }
    if (!res.ok) throw new AudiusApiError('unavailable', `Audius HTTP ${res.status}`)
    let body: unknown
    try {
      body = await res.json()
    } catch {
      throw new AudiusApiError('unavailable', 'Risposta non valida da Audius')
    }
    const raw = isRecord(body) && Array.isArray(body.data) ? body.data : []
    const items = raw.map(audiusToTrack).filter((x): x is Track => x !== null)
    const offset = options.offset ?? 0
    return { items, nextOffset: options.noPaging || raw.length < PAGE_SIZE ? null : offset + raw.length }
  }
}

export const audius = new AudiusClient({
  fetch: (input, init) => fetch(input, init),
  isOnline: () => navigator.onLine,
})
