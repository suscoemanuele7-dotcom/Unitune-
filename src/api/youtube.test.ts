/**
 * Test del client reale: la Edge Function è simulata con MSW.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { EdgeFunctionYouTubeClient, MockYouTubeClient, YouTubeApiError, type CooldownState, type EdgeClientDeps } from './youtube'

const FN = 'https://proj.supabase.co/functions/v1/youtube'
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

const track = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  channelTitle: 'Rick Astley',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  durationSec: 213,
}

let now: number
let online: boolean
let cooldown: CooldownState | null
let calls: number

function client(overrides: Partial<EdgeClientDeps> = {}) {
  return new EdgeFunctionYouTubeClient({
    functionUrl: FN,
    anonKey: 'anon',
    getAccessToken: () => Promise.resolve('jwt'),
    fetch: (input, init) => fetch(input, init),
    now: () => now,
    isOnline: () => online,
    cooldownStore: {
      get: () => cooldown,
      set: (v) => {
        cooldown = v
      },
    },
    minIntervalMs: 0,
    ...overrides,
  })
}

async function expectCode(promise: Promise<unknown>, code: string) {
  const error: unknown = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(YouTubeApiError)
  expect((error as YouTubeApiError).code).toBe(code)
  return error as YouTubeApiError
}

beforeEach(() => {
  now = 1_000_000
  online = true
  cooldown = null
  calls = 0
})

describe('EdgeFunctionYouTubeClient', () => {
  it('invia la richiesta autenticata e restituisce i brani', async () => {
    server.use(
      http.post(FN, async ({ request }) => {
        calls++
        expect(request.headers.get('authorization')).toBe('Bearer jwt')
        expect(request.headers.get('apikey')).toBe('anon')
        expect(await request.json()).toEqual({ op: 'search', q: 'rick astley' })
        return HttpResponse.json({ items: [track], nextPageToken: null, cached: false })
      }),
    )
    const c = client()
    const result = await c.search('  Rick  Astley ')
    expect(result.items).toEqual([track])
    // Stessa ricerca: dalla cache in memoria, nessuna nuova richiesta.
    await c.search('rick astley')
    expect(calls).toBe(1)
  })

  it('query vuota: nessuna richiesta', async () => {
    expect(await client().search('   ')).toEqual({ items: [], nextPageToken: null })
  })

  it('offline: errore "offline" senza toccare la rete', async () => {
    online = false
    await expectCode(client().search('x'), 'offline')
  })

  it('senza sessione: unauthorized', async () => {
    await expectCode(client({ getAccessToken: () => Promise.resolve(null) }).search('x'), 'unauthorized')
  })

  it('quota esaurita: errore tipizzato e periodo di attesa fino al reset', async () => {
    server.use(
      http.post(FN, () => {
        calls++
        return HttpResponse.json(
          { error: { code: 'quota_exceeded', message: 'Quota', retryAfterSec: 3600 } },
          { status: 503 },
        )
      }),
    )
    const c = client()
    const e = await expectCode(c.search('a'), 'quota_exceeded')
    expect(e.retryAfterSec).toBe(3600)
    expect(cooldown).toEqual({ code: 'quota_exceeded', until: now + 3_600_000 })

    // Durante l'attesa non si chiama più il server.
    now += 1000
    const again = await expectCode(c.search('b'), 'quota_exceeded')
    expect(again.retryAfterSec).toBe(3599)
    expect(calls).toBe(1)

    // Dopo il reset si riprova davvero.
    now += 3_600_000
    await expectCode(c.search('c'), 'quota_exceeded')
    expect(calls).toBe(2)
  })

  it('tetto utente raggiunto', async () => {
    server.use(
      http.post(FN, () =>
        HttpResponse.json({ error: { code: 'user_quota_exceeded', message: 'x', retryAfterSec: 60 } }, { status: 429 }),
      ),
    )
    await expectCode(client().search('a'), 'user_quota_exceeded')
  })

  it('errore di rete', async () => {
    server.use(http.post(FN, () => HttpResponse.error()))
    await expectCode(client().search('a'), 'network')
  })

  it('risposta di errore senza corpo JSON → codice dedotto dallo status', async () => {
    server.use(http.post(FN, () => new HttpResponse('gateway', { status: 401 })))
    await expectCode(client().search('a'), 'unauthorized')
  })

  it('annullamento tramite AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expectCode(client({ minIntervalMs: 10_000 }).search('a', { signal: controller.signal }), 'aborted')
  })
})

describe('MockYouTubeClient', () => {
  it('cerca nel catalogo dimostrativo', async () => {
    const result = await new MockYouTubeClient(0).search('ed sheeran')
    expect(result.items.length).toBe(3)
    expect(result.items.every((t) => t.title.includes('Ed Sheeran'))).toBe(true)
  })
  it('simula la quota esaurita', async () => {
    await expectCode(new MockYouTubeClient(0).search('!quota'), 'quota_exceeded')
  })
})
