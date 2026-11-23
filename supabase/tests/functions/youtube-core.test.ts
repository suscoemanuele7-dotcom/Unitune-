import { describe, expect, it } from 'vitest'
import {
  decodeHtmlEntities,
  mapGoogleError,
  normalizeQuery,
  parseIsoDuration,
  parseSearchResponse,
  parseVideosResponse,
  secondsUntilQuotaReset,
} from '../../functions/_shared/youtube-core.ts'

describe('parseIsoDuration', () => {
  it.each([
    ['PT3M33S', 213],
    ['PT1H2M3S', 3723],
    ['PT45S', 45],
    ['PT10M', 600],
    ['P1DT1S', 86401],
    ['P0D', 0],
  ])('%s → %d', (iso, expected) => {
    expect(parseIsoDuration(iso)).toBe(expected)
  })
  it.each(['', 'P', 'PT', '3:33', 'PTXS'])('formato non valido "%s" → null', (iso) => {
    expect(parseIsoDuration(iso)).toBeNull()
  })
})

describe('decodeHtmlEntities', () => {
  it('decodifica entità nominate e numeriche', () => {
    expect(decodeHtmlEntities('Rock &amp; Roll &#39;n&#x27; &quot;Blues&quot; &lt;3')).toBe(`Rock & Roll 'n' "Blues" <3`)
  })
  it('lascia invariate le entità sconosciute', () => {
    expect(decodeHtmlEntities('a &foo; b')).toBe('a &foo; b')
  })
})

describe('parseSearchResponse', () => {
  it('estrae ID validi e unici e il token pagina', () => {
    const r = parseSearchResponse({
      nextPageToken: 'NEXT',
      items: [{ id: { videoId: 'dQw4w9WgXcQ' } }, { id: { videoId: 'dQw4w9WgXcQ' } }, { id: { videoId: 'bad' } }, {}],
    })
    expect(r).toEqual({ videoIds: ['dQw4w9WgXcQ'], nextPageToken: 'NEXT' })
  })
  it('tollera risposte malformate', () => {
    expect(parseSearchResponse(null)).toEqual({ videoIds: [], nextPageToken: null })
  })
})

describe('parseVideosResponse', () => {
  const item = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    snippet: { title: `T &amp; ${id}`, channelTitle: 'Canale', thumbnails: { high: { url: `https://img/${id}` } } },
    contentDetails: { duration: 'PT3M' },
    status: { embeddable: true, privacyStatus: 'public' },
    ...extra,
  })

  it("mantiene l'ordine della ricerca e mappa i campi", () => {
    const tracks = parseVideosResponse({ items: [item('bbbbbbbbbbb'), item('aaaaaaaaaaa')] }, ['aaaaaaaaaaa', 'bbbbbbbbbbb'])
    expect(tracks.map((t) => t.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb'])
    expect(tracks[0]).toEqual({
      videoId: 'aaaaaaaaaaa',
      title: 'T & aaaaaaaaaaa',
      channelTitle: 'Canale',
      thumbnailUrl: 'https://img/aaaaaaaaaaa',
      durationSec: 180,
    })
  })

  it('scarta video non incorporabili o privati', () => {
    const tracks = parseVideosResponse(
      {
        items: [
          item('aaaaaaaaaaa', { status: { embeddable: false, privacyStatus: 'public' } }),
          item('bbbbbbbbbbb', { status: { embeddable: true, privacyStatus: 'private' } }),
          item('ccccccccccc'),
        ],
      },
      ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'],
    )
    expect(tracks.map((t) => t.videoId)).toEqual(['ccccccccccc'])
  })

  it('usa la thumbnail standard se mancano le thumbnail', () => {
    const [t] = parseVideosResponse({ items: [item('aaaaaaaaaaa', { snippet: { title: 'x', channelTitle: 'y' } })] }, [
      'aaaaaaaaaaa',
    ])
    expect(t?.thumbnailUrl).toBe('https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg')
  })
})

describe('mapGoogleError', () => {
  const body = (reason: string) => ({ error: { code: 403, errors: [{ reason }] } })
  it('quota esaurita', () => {
    expect(mapGoogleError(403, body('quotaExceeded')).code).toBe('quota_exceeded')
  })
  it('rate limit', () => {
    expect(mapGoogleError(403, body('rateLimitExceeded')).code).toBe('rate_limited')
  })
  it('chiave non valida → upstream_error con motivo', () => {
    const e = mapGoogleError(400, body('keyInvalid'))
    expect(e).toMatchObject({ code: 'upstream_error', status: 502 })
    expect(mapGoogleError(400, body('invalidParameter')).code).toBe('bad_request')
    const e2 = mapGoogleError(403, body('ipRefererBlocked'))
    expect(e2).toMatchObject({ code: 'upstream_error', status: 502 })
    expect(e2.message).toContain('ipRefererBlocked')
  })
})

describe('secondsUntilQuotaReset', () => {
  it('calcola i secondi alla mezzanotte del Pacifico', () => {
    // 2026-01-15 07:00 UTC = 23:00 PST → mancano 3600 s
    expect(secondsUntilQuotaReset(new Date('2026-01-15T07:00:00Z'))).toBe(3600)
    // 2026-07-15 06:30 UTC = 23:30 PDT → mancano 1800 s
    expect(secondsUntilQuotaReset(new Date('2026-07-15T06:30:00Z'))).toBe(1800)
  })
})

describe('normalizeQuery', () => {
  it('rimuove spazi superflui e porta in minuscolo', () => {
    expect(normalizeQuery('  Queen   Bohemian  ')).toBe('queen bohemian')
  })
})
