/**
 * Raccomandazioni "basiche" per la sezione "Scelti per te".
 *
 * Nota sul perché sono semplici: la YouTube Data API non offre più la
 * ricerca di video correlati (`relatedToVideoId` è stato rimosso nel 2023)
 * e ogni search.list costa 100 unità di quota. Quindi:
 * 1. calcoliamo gli artisti preferiti dalla cronologia (ascolti recenti
 *    pesano di più) e dai preferiti;
 * 2. diamo un punteggio ai brani già noti all'app (preferiti, playlist
 *    aperte, cronologia meno recente, più UNA ricerca cache-ata per
 *    l'artista più ascoltato);
 * 3. escludiamo ciò che hai ascoltato da poco.
 */
import type { FavoriteEntry, HistoryEntry, Track } from '../types'
import { displayInfo } from './trackDisplay'

const DAY_MS = 86_400_000

export interface ArtistScore {
  artist: string
  score: number
}

function artistKey(track: Track): string {
  return displayInfo(track).artist.trim().toLowerCase()
}

export function topArtists(history: readonly HistoryEntry[], favorites: readonly FavoriteEntry[], now: number): ArtistScore[] {
  const scores = new Map<string, { name: string; score: number }>()
  const add = (track: Track, weight: number) => {
    const name = displayInfo(track).artist.trim()
    const key = name.toLowerCase()
    if (!key) return
    const prev = scores.get(key)
    scores.set(key, { name: prev?.name ?? name, score: (prev?.score ?? 0) + weight })
  }
  for (const h of history) {
    const ageDays = Math.max(0, now - new Date(h.playedAt).getTime()) / DAY_MS
    add(h.track, Math.exp(-ageDays / 14))
  }
  for (const f of favorites) add(f.track, 1.5)
  return [...scores.values()]
    .map(({ name, score }) => ({ artist: name, score }))
    .sort((a, b) => b.score - a.score)
}

/** Piccola variazione deterministica per giorno: suggerimenti che cambiano. */
function dailyJitter(videoId: string, now: number): number {
  const day = Math.floor(now / DAY_MS)
  let h = day
  for (let i = 0; i < videoId.length; i++) h = (h * 31 + videoId.charCodeAt(i)) | 0
  return (Math.abs(h) % 1000) / 1000
}

export interface RecommendationInput {
  history: readonly HistoryEntry[]
  favorites: readonly FavoriteEntry[]
  /** Altri brani candidati (playlist, risultati di ricerca per artista…). */
  pool: readonly Track[]
  now: number
  limit?: number
  /** Quanti ascolti recenti escludere. */
  recentWindow?: number
}

export function recommend({ history, favorites, pool, now, limit = 12, recentWindow = 10 }: RecommendationInput): Track[] {
  const recent = new Set(history.slice(0, recentWindow).map((h) => h.track.videoId))
  const favoriteIds = new Set(favorites.map((f) => f.track.videoId))
  const artists = new Map(topArtists(history, favorites, now).map((a) => [a.artist.toLowerCase(), a.score]))
  const coldStart = artists.size === 0

  const candidates = new Map<string, Track>()
  for (const track of [...pool, ...favorites.map((f) => f.track), ...history.map((h) => h.track)]) {
    if (!recent.has(track.videoId) && !candidates.has(track.videoId)) candidates.set(track.videoId, track)
  }

  return [...candidates.values()]
    .map((track) => {
      const artistScore = artists.get(artistKey(track)) ?? 0
      const score = coldStart
        ? dailyJitter(track.videoId, now)
        : artistScore + (favoriteIds.has(track.videoId) ? 0.5 : 0) + dailyJitter(track.videoId, now) * 0.3
      return { track, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.track)
}
