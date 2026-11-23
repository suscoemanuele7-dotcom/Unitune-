/**
 * Test del client Audius. La risposta in __fixtures__ è un estratto di una
 * risposta reale di https://api.audius.co/v1/tracks/search (nov. 2026).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import fixture from './__fixtures__/audius-search.json'
import { AudiusApiError, AudiusClient, audiusToTrack } from './audius'

const BASE = 'https://api.test/v1'
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

let online = true
const client = new AudiusClient({ fetch: (i, init) => fetch(i, init), isOnline: () => online, baseUrl: BASE })

describe('audiusToTrack', () => {
  it('mappa i campi e costruisce il link di attribuzione', () => {
    const track = audiusToTrack(fixture.data[1])
    expect(track).toMatchObject({
      source: 'audius',
      id: fixture.data[1]?.id,
      title: fixture.data[1]?.title,
      channelTitle: fixture.data[1]?.user.name,
      durationSec: fixture.data[1]?.duration,
      externalUrl: `https://audius.co${fixture.data[1]?.permalink ?? ''}`,
    })
    expect(track?.thumbnailUrl).toMatch(/480x480/)
  })
  it('scarta i brani non riproducibili in streaming', () => {
    expect(fixture.data[0]?.is_streamable).toBe(false)
    expect(audiusToTrack(fixture.data[0])).toBeNull()
    expect(audiusToTrack({ ...fixture.data[1], is_stream_gated: true })).toBeNull()
    expect(audiusToTrack({ ...fixture.data[1], access: { stream: false } })).toBeNull()
    expect(audiusToTrack({ ...fixture.data[1], id: 'id-non-valido!' })).toBeNull()
    expect(audiusToTrack(null)).toBeNull()
  })
})

describe('AudiusClient', () => {
  it('cerca con app_name e restituisce solo brani riproducibili', async () => {
    server.use(
      http.get(`${BASE}/tracks/search`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('query')).toBe('lofi')
        expect(url.searchParams.get('app_name')).toBe('UniTune')
        return HttpResponse.json(fixture)
      }),
    )
    const page = await client.search(' lofi ')
    expect(page.items).toHaveLength(2)
    expect(page.nextOffset).toBeNull()
  })

  it('tendenze per genere', async () => {
    server.use(
      http.get(`${BASE}/tracks/trending`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('genre')).toBe('Electronic')
        return HttpResponse.json(fixture)
      }),
    )
    expect((await client.trending({ genre: 'Electronic' })).items.length).toBe(2)
  })

  it('URL dello stream', () => {
    expect(client.streamUrl('V66vyPP')).toBe(`${BASE}/tracks/V66vyPP/stream?app_name=UniTune`)
  })

  it('errori: offline, HTTP, rete', async () => {
    online = false
    await expect(client.search('x')).rejects.toMatchObject({ code: 'offline' })
    online = true
    server.use(http.get(`${BASE}/tracks/search`, () => new HttpResponse(null, { status: 503 })))
    await expect(client.search('x')).rejects.toBeInstanceOf(AudiusApiError)
    server.use(http.get(`${BASE}/tracks/search`, () => HttpResponse.error()))
    await expect(client.search('x')).rejects.toMatchObject({ code: 'network' })
  })
})
