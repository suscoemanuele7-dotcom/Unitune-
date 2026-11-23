import { describe, expect, it } from 'vitest'
import type { HistoryEntry, Track } from '../types'
import { recommend, topArtists } from './recommendations'

const NOW = new Date('2026-11-22T12:00:00Z').getTime()
const tr = (id: string, artist: string): Track => ({
  source: 'youtube',
  id: id.padEnd(11, '0'),
  externalUrl: '',
  title: `${artist} - Brano ${id}`,
  channelTitle: artist,
  thumbnailUrl: '',
  durationSec: 200,
})
const played = (track: Track, daysAgo: number): HistoryEntry => ({
  id: `${track.id}-${daysAgo}`,
  track,
  playedAt: new Date(NOW - daysAgo * 86_400_000).toISOString(),
})

describe('topArtists', () => {
  it('pesa di più gli ascolti recenti e i preferiti', () => {
    const history = [played(tr('a1', 'Adele'), 0), played(tr('q1', 'Queen'), 30), played(tr('q2', 'Queen'), 31)]
    const ranking = topArtists(history, [], NOW)
    expect(ranking[0]?.artist).toBe('Adele')
    const withFav = topArtists(history, [{ track: tr('q3', 'Queen'), createdAt: '' }], NOW)
    expect(withFav[0]?.artist).toBe('Queen')
  })
})

describe('recommend', () => {
  it('privilegia gli artisti più ascoltati ed esclude gli ascolti recenti', () => {
    const history = [played(tr('a1', 'Adele'), 0), played(tr('a2', 'Adele'), 1)]
    const pool = [tr('x1', 'Nirvana'), tr('a3', 'Adele'), tr('a1', 'Adele')]
    const result = recommend({ history, favorites: [], pool, now: NOW })
    expect(result[0]?.id).toBe(tr('a3', 'Adele').id)
    expect(result.map((t) => t.id)).not.toContain(tr('a1', 'Adele').id)
    expect(result.map((t) => t.id)).not.toContain(tr('a2', 'Adele').id)
  })

  it('senza cronologia (primo avvio) propone comunque il pool, senza duplicati', () => {
    const pool = [tr('x1', 'A'), tr('x2', 'B'), tr('x1', 'A')]
    const result = recommend({ history: [], favorites: [], pool, now: NOW })
    expect(result).toHaveLength(2)
  })

  it('rispetta il limite', () => {
    const pool = Array.from({ length: 30 }, (_, i) => tr(`p${i}`, `Artista ${i}`))
    expect(recommend({ history: [], favorites: [], pool, now: NOW, limit: 5 })).toHaveLength(5)
  })

  it('è deterministico nello stesso giorno', () => {
    const pool = Array.from({ length: 10 }, (_, i) => tr(`p${i}`, `Artista ${i}`))
    const a = recommend({ history: [], favorites: [], pool, now: NOW })
    const b = recommend({ history: [], favorites: [], pool, now: NOW + 3_600_000 })
    expect(a).toEqual(b)
  })
})
