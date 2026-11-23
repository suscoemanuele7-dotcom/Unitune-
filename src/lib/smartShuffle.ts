/**
 * Smart Shuffle: sceglie brani SIMILI a una lista (playlist, preferiti…)
 * da inserire nella riproduzione casuale, come fanno le app musicali.
 *
 * "Simile" qui significa (in ordine di peso):
 * 1. stesso artista di brani della lista;
 * 2. stesso genere (disponibile per i brani Audius);
 * 3. stessa fonte (un brano Audius in una lista Audius continua a suonare
 *    anche a schermo spento).
 * I candidati arrivano dalla libreria dell'utente e da poche ricerche mirate
 * (vedi src/player/smartShuffleSource.ts).
 */
import type { Track } from '../types'
import { trackKey } from '../../supabase/functions/_shared/contract.ts'
import { displayInfo } from './trackDisplay'

export interface ContextProfile {
  /** artista (minuscolo) → numero di brani nella lista */
  artists: Map<string, number>
  genres: Map<string, number>
  sources: Map<Track['source'], number>
  keys: Set<string>
  size: number
}

export function artistOf(track: Track): string {
  return displayInfo(track).artist.trim().toLowerCase()
}

function bump<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

export function profile(context: readonly Track[]): ContextProfile {
  const p: ContextProfile = { artists: new Map(), genres: new Map(), sources: new Map(), keys: new Set(), size: context.length }
  for (const t of context) {
    const a = artistOf(t)
    if (a) bump(p.artists, a)
    if (t.genre) bump(p.genres, t.genre.toLowerCase())
    bump(p.sources, t.source)
    p.keys.add(trackKey(t))
  }
  return p
}

/** Artisti e generi più presenti: guidano le ricerche dei candidati. */
export function topEntries(map: Map<string, number>, n: number): string[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k)
}

function hash(text: string, seed: number): number {
  let h = seed
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return (Math.abs(h) % 1000) / 1000
}

/**
 * Punteggio di somiglianza; 0 se il brano non ha né artista né genere in
 * comune con la lista (la sola fonte non basta a renderlo "simile").
 */
export function similarityScore(p: ContextProfile, track: Track): number {
  if (p.size === 0) return 0
  const artist = (p.artists.get(artistOf(track)) ?? 0) / p.size
  const genre = track.genre ? (p.genres.get(track.genre.toLowerCase()) ?? 0) / p.size : 0
  const relevance = artist * 3 + genre * 2
  if (relevance === 0) return 0
  const source = (p.sources.get(track.source) ?? 0) / p.size
  return relevance + source * 0.5
}

/**
 * I `limit` candidati più simili alla lista, esclusi quelli già presenti.
 * Per non riempire tutto con un solo artista, al massimo 2 brani per artista.
 * `seed` introduce una variazione: ogni Smart Shuffle è un po' diverso.
 */
export function pickSimilar(context: readonly Track[], candidates: readonly Track[], limit: number, seed = 1): Track[] {
  const p = profile(context)
  const seen = new Set<string>()
  const scored = candidates
    .filter((t) => {
      const k = trackKey(t)
      if (p.keys.has(k) || seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map((t) => ({ t, relevance: similarityScore(p, t) }))
    .filter((x) => x.relevance > 0)
    .map(({ t, relevance }) => ({ t, score: relevance + hash(trackKey(t), seed) * 0.25 }))
    .sort((a, b) => b.score - a.score)

  const perArtist = new Map<string, number>()
  const out: Track[] = []
  for (const { t } of scored) {
    const a = artistOf(t)
    const count = perArtist.get(a) ?? 0
    if (count >= 2) continue
    perArtist.set(a, count + 1)
    out.push(t)
    if (out.length === limit) break
  }
  return out
}

/** Quanti consigliati inserire: uno ogni 3 brani, tra 3 e 15. */
export function recommendationCount(contextSize: number): number {
  return Math.min(15, Math.max(3, Math.ceil(contextSize / 3)))
}
