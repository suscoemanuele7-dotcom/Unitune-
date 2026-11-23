/**
 * Raccolta dei candidati per lo Smart Shuffle.
 *
 * Fonti, dalla più economica:
 * 1. libreria dell'utente (preferiti, cronologia, playlist aperte): gratis;
 * 2. Audius (API pubblica, nessuna quota): tendenze dei generi principali e
 *    ricerca dell'artista principale della lista;
 * 3. YouTube: al massimo UNA ricerca (100 unità di quota) per l'artista
 *    principale, con cache di 12 ore sul dispositivo.
 */
import { audius } from '../api/audius'
import { youtube } from '../api/client'
import { useLibraryStore } from '../data/useLibraryStore'
import { pickSimilar, profile, recommendationCount, topEntries, artistOf } from '../lib/smartShuffle'
import { displayInfo } from '../lib/trackDisplay'
import { isRecord, readJson, writeJson } from '../lib/storage'
import type { Track } from '../types'

const YT_CACHE_KEY = 'unitune.smartshuffle.yt.v1'
const YT_CACHE_TTL_MS = 12 * 3_600_000

type YtCache = Record<string, { at: number; items: Track[] }>

function isYtCache(v: unknown): v is YtCache {
  return isRecord(v) && Object.values(v).every((e) => isRecord(e) && typeof e.at === 'number' && Array.isArray(e.items))
}

async function youtubeByArtist(artist: string, signal?: AbortSignal): Promise<Track[]> {
  const cache = readJson(YT_CACHE_KEY, isYtCache) ?? {}
  const hit = cache[artist]
  if (hit && Date.now() - hit.at < YT_CACHE_TTL_MS) return hit.items
  const result = await youtube.search(artist, signal ? { signal } : {})
  // Si tengono solo le ultime 10 ricerche.
  const entries = Object.entries({ ...cache, [artist]: { at: Date.now(), items: result.items } })
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, 10)
  writeJson(YT_CACHE_KEY, Object.fromEntries(entries))
  return result.items
}

/** Nome dell'artista come scritto nei brani (non in minuscolo), per le ricerche. */
function displayArtist(context: readonly Track[], lower: string): string {
  const t = context.find((x) => artistOf(x) === lower)
  return t ? displayInfo(t).artist : lower
}

export async function findSimilarTracks(context: readonly Track[], signal?: AbortSignal): Promise<Track[]> {
  if (context.length === 0) return []
  const lib = useLibraryStore.getState()
  const pool: Track[] = [
    ...lib.favorites.map((f) => f.track),
    ...lib.history.map((h) => h.track),
    ...Object.values(lib.playlistCache).flatMap((d) => d.entries.map((e) => e.track)),
  ]

  const p = profile(context)
  const jobs: Promise<Track[]>[] = []
  const audiusTracks = context.filter((t) => t.source === 'audius')
  const youtubeTracks = context.filter((t) => t.source === 'youtube')

  if (audiusTracks.length > 0) {
    const ap = profile(audiusTracks)
    for (const genreLower of topEntries(ap.genres, 2)) {
      const genre = audiusTracks.find((t) => t.genre?.toLowerCase() === genreLower)?.genre
      if (genre) jobs.push(audius.trending({ genre, ...(signal ? { signal } : {}) }).then((r) => r.items))
    }
    const artist = topEntries(ap.artists, 1)[0]
    if (artist) jobs.push(audius.search(displayArtist(audiusTracks, artist), signal ? { signal } : {}).then((r) => r.items))
  }
  if (youtubeTracks.length > 0) {
    const artist = topEntries(profile(youtubeTracks).artists, 1)[0]
    if (artist) jobs.push(youtubeByArtist(displayArtist(youtubeTracks, artist), signal))
  }

  const settled = await Promise.allSettled(jobs)
  const fetched = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  return pickSimilar(context, [...pool, ...fetched], recommendationCount(p.size), Date.now())
}
