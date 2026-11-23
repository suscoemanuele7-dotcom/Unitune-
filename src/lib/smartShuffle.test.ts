import { describe, expect, it } from 'vitest'
import type { Track } from '../types'
import { pickSimilar, profile, recommendationCount, topEntries } from './smartShuffle'

let n = 0
const tr = (artist: string, opts: Partial<Track> = {}): Track => {
  n++
  return {
    source: 'audius',
    id: `t${n}`,
    title: `Brano ${n}`,
    channelTitle: artist,
    thumbnailUrl: '',
    durationSec: 100,
    externalUrl: '',
    ...opts,
  }
}

describe('pickSimilar', () => {
  const context = [tr('Lofi Girl', { genre: 'Lo-Fi' }), tr('Lofi Girl', { genre: 'Lo-Fi' }), tr('Chillhop', { genre: 'Lo-Fi' })]

  it('preferisce lo stesso artista, poi lo stesso genere; scarta i non pertinenti', () => {
    const sameArtist = tr('Lofi Girl', { genre: 'Lo-Fi' })
    const sameGenre = tr('Altro', { genre: 'Lo-Fi' })
    const unrelated = tr('Metal Band', { genre: 'Metal', source: 'youtube' })
    const result = pickSimilar(context, [unrelated, sameGenre, sameArtist], 5)
    expect(result[0]).toBe(sameArtist)
    expect(result[1]).toBe(sameGenre)
    expect(result).not.toContain(unrelated)
  })

  it('esclude i brani già nella lista e i duplicati', () => {
    const extra = tr('Lofi Girl', { genre: 'Lo-Fi' })
    const result = pickSimilar(context, [context[0] as Track, extra, extra], 5)
    expect(result).toEqual([extra])
  })

  it('al massimo 2 brani per artista', () => {
    const many = Array.from({ length: 5 }, () => tr('Lofi Girl', { genre: 'Lo-Fi' }))
    expect(pickSimilar(context, many, 10)).toHaveLength(2)
  })

  it('YouTube: riconosce l’artista dal titolo "Artista - Titolo"', () => {
    const yt = (title: string, channel: string): Track => tr(channel, { source: 'youtube', title, channelTitle: channel })
    const ctx = [yt('Coldplay - Paradise', 'Coldplay'), yt('Coldplay - Yellow', 'ColdplayVEVO')]
    const candidate = yt('Coldplay - Fix You', 'Coldplay')
    expect(pickSimilar(ctx, [candidate, yt('Altro - Brano', 'Altro')], 5)).toEqual([candidate])
  })
})

describe('profile / topEntries / recommendationCount', () => {
  it('conta artisti e generi', () => {
    const p = profile([tr('A', { genre: 'Pop' }), tr('A', { genre: 'Pop' }), tr('B', { genre: 'Rock' })])
    expect(topEntries(p.artists, 1)).toEqual(['a'])
    expect(topEntries(p.genres, 2)).toEqual(['pop', 'rock'])
  })
  it('numero di consigliati', () => {
    expect(recommendationCount(1)).toBe(3)
    expect(recommendationCount(12)).toBe(4)
    expect(recommendationCount(100)).toBe(15)
  })
})
