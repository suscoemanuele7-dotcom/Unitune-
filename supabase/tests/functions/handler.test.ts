/**
 * Test dell'handler della Edge Function. La YouTube Data API è simulata con
 * MSW (intercetta le richieste HTTP reali verso googleapis.com).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createHandler, type CachedSearch, type HandlerDeps } from '../../functions/_shared/handler.ts'
import type { ApiErrorBody, SearchResponse } from '../../functions/_shared/contract.ts'

const SEARCH = 'https://www.googleapis.com/youtube/v3/search'
const VIDEOS = 'https://www.googleapis.com/youtube/v3/videos'

const server = setupServer()
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

let searchCalls = 0
let cacheStore: Map<string, CachedSearch>
let quotaLeft: number

function okHandlers() {
  return [
    http.get(SEARCH, ({ request }) => {
      searchCalls++
      const url = new URL(request.url)
      expect(url.searchParams.get('videoCategoryId')).toBe('10')
      expect(url.searchParams.get('type')).toBe('video')
      expect(url.searchParams.get('videoEmbeddable')).toBe('true')
      expect(url.searchParams.get('key')).toBe('TEST_KEY')
      return HttpResponse.json({ nextPageToken: 'P2', items: [{ id: { videoId: 'dQw4w9WgXcQ' } }] })
    }),
    http.get(VIDEOS, () =>
      HttpResponse.json({
        items: [
          {
            id: 'dQw4w9WgXcQ',
            snippet: { title: 'Never Gonna Give You Up', channelTitle: 'Rick Astley', thumbnails: {} },
            contentDetails: { duration: 'PT3M33S' },
            status: { embeddable: true, privacyStatus: 'public' },
          },
        ],
      }),
    ),
  ]
}

function makeHandler(overrides: Partial<HandlerDeps> = {}) {
  return createHandler({
    apiKey: 'TEST_KEY',
    fetch: (input, init) => fetch(input, init),
    authenticate: (auth) => Promise.resolve(auth === 'Bearer valid' ? 'user-1' : null),
    consumeUserQuota: () => Promise.resolve(quotaLeft-- > 0),
    cache: {
      get: (k) => Promise.resolve(cacheStore.get(k) ?? null),
      set: (k, v) => {
        cacheStore.set(k, v)
        return Promise.resolve()
      },
    },
    allowedOrigins: ['https://app.example'],
    regionCode: 'IT',
    relevanceLanguage: 'it',
    cacheTtlSec: 3600,
    now: () => new Date('2026-01-15T07:00:00Z'),
    log: () => undefined,
    ...overrides,
  })
}

function req(body: unknown, auth = 'Bearer valid', origin = 'https://app.example') {
  return new Request('https://fn.example/youtube', {
    method: 'POST',
    headers: { authorization: auth, origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  searchCalls = 0
  cacheStore = new Map()
  quotaLeft = 10
})

describe('handler youtube', () => {
  it('cerca, arricchisce con videos.list e mette in cache', async () => {
    server.use(...okHandlers())
    const handler = makeHandler()
    const res = await handler(req({ op: 'search', q: '  Rick   Astley ' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
    const body = (await res.json()) as SearchResponse
    expect(body).toEqual({
      items: [
        {
          videoId: 'dQw4w9WgXcQ',
          title: 'Never Gonna Give You Up',
          channelTitle: 'Rick Astley',
          thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          durationSec: 213,
        },
      ],
      nextPageToken: 'P2',
      cached: false,
    })

    // Seconda richiesta equivalente: servita dalla cache, nessuna chiamata a Google.
    const again = await handler(req({ op: 'search', q: 'rick astley' }))
    expect(((await again.json()) as SearchResponse).cached).toBe(true)
    expect(searchCalls).toBe(1)
  })

  it('risponde al preflight CORS', async () => {
    const res = await makeHandler()(
      new Request('https://fn.example/youtube', { method: 'OPTIONS', headers: { origin: 'https://app.example' } }),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization')
  })

  it('non concede CORS a origini non autorizzate', async () => {
    server.use(...okHandlers())
    const res = await makeHandler()(req({ op: 'search', q: 'x' }, 'Bearer valid', 'https://evil.example'))
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('401 senza sessione valida', async () => {
    const res = await makeHandler()(req({ op: 'search', q: 'x' }, 'Bearer nope'))
    expect(res.status).toBe(401)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('unauthorized')
  })

  it('400 con input non valido', async () => {
    const handler = makeHandler()
    expect((await handler(req({ op: 'search', q: '   ' }))).status).toBe(400)
    expect((await handler(req({ op: 'search', q: 'x'.repeat(101) }))).status).toBe(400)
    expect((await handler(req({ op: 'download', q: 'x' }))).status).toBe(400)
  })

  it('503 not_configured se manca la API key', async () => {
    const res = await makeHandler({ apiKey: undefined })(req({ op: 'search', q: 'x' }))
    expect(res.status).toBe(503)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('not_configured')
  })

  it("429 user_quota_exceeded quando l'utente supera il tetto", async () => {
    server.use(...okHandlers())
    quotaLeft = 0
    const res = await makeHandler()(req({ op: 'search', q: 'x' }))
    expect(res.status).toBe(429)
    const body = (await res.json()) as ApiErrorBody
    expect(body.error.code).toBe('user_quota_exceeded')
    expect(body.error.retryAfterSec).toBe(3600)
    expect(searchCalls).toBe(0)
  })

  it('quota Google esaurita → 503 quota_exceeded con Retry-After', async () => {
    server.use(
      http.get(SEARCH, () =>
        HttpResponse.json({ error: { code: 403, errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 }),
      ),
    )
    const res = await makeHandler()(req({ op: 'search', q: 'x' }))
    expect(res.status).toBe(503)
    expect(res.headers.get('retry-after')).toBe('3600')
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('quota_exceeded')
  })

  it('errore di rete verso Google → 502 upstream_error', async () => {
    server.use(http.get(SEARCH, () => HttpResponse.error()))
    const res = await makeHandler()(req({ op: 'search', q: 'x' }))
    expect(res.status).toBe(502)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('upstream_error')
  })

  it('un guasto della cache non blocca la ricerca', async () => {
    server.use(...okHandlers())
    const res = await makeHandler({
      cache: { get: () => Promise.reject(new Error('db giù')), set: () => Promise.reject(new Error('db giù')) },
    })(req({ op: 'search', q: 'x' }))
    expect(res.status).toBe(200)
  })

  it('nessun risultato: non chiama videos.list', async () => {
    server.use(http.get(SEARCH, () => HttpResponse.json({ items: [] })))
    const res = await makeHandler()(req({ op: 'search', q: 'zzz' }))
    expect(((await res.json()) as SearchResponse).items).toEqual([])
  })
})
