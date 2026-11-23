import { useEffect, useMemo, useState } from 'react'
import { youtube } from '../api/client'
import { useLibraryStore } from '../data/useLibraryStore'
import { recommend, topArtists } from '../lib/recommendations'
import { isRecord, readJson, writeJson } from '../lib/storage'
import type { Track } from '../types'

const CACHE_KEY = 'unitune.reco.artist.v1'
/** Al massimo UNA ricerca (100 unità di quota) ogni 12 ore per i suggerimenti. */
const CACHE_TTL_MS = 12 * 3_600_000

interface ArtistCache {
  artist: string
  at: number
  items: Track[]
}

function isArtistCache(v: unknown): v is ArtistCache {
  return isRecord(v) && typeof v.artist === 'string' && typeof v.at === 'number' && Array.isArray(v.items)
}

export function useRecommendations(): Track[] {
  const history = useLibraryStore((s) => s.history)
  const favorites = useLibraryStore((s) => s.favorites)
  const playlistCache = useLibraryStore((s) => s.playlistCache)
  const universityPlaylists = useLibraryStore((s) => s.universityPlaylists)
  const [artistTracks, setArtistTracks] = useState<Track[]>(() => readJson(CACHE_KEY, isArtistCache)?.items ?? [])
  const [now] = useState(() => Date.now())

  const top = useMemo(() => topArtists(history, favorites, now)[0]?.artist ?? null, [history, favorites, now])

  // Carica le playlist dell'università (servono come pool e per il primo avvio).
  useEffect(() => {
    const cache = useLibraryStore.getState().playlistCache
    for (const p of universityPlaylists.slice(0, 3)) {
      if (!cache[p.id]) useLibraryStore.getState().loadPlaylist(p.id).catch(() => undefined)
    }
  }, [universityPlaylists])

  // Una ricerca per l'artista più ascoltato, con cache di 12 ore.
  useEffect(() => {
    if (!top || !navigator.onLine) return
    const cached = readJson(CACHE_KEY, isArtistCache)
    if (cached && cached.artist === top && Date.now() - cached.at < CACHE_TTL_MS) return
    const controller = new AbortController()
    youtube
      .search(top, { signal: controller.signal })
      .then((result) => {
        writeJson(CACHE_KEY, { artist: top, at: Date.now(), items: result.items } satisfies ArtistCache)
        setArtistTracks(result.items)
      })
      .catch(() => {
        // Quota esaurita o offline: i suggerimenti si basano sul resto.
      })
    return () => {
      controller.abort()
    }
  }, [top])

  return useMemo(() => {
    const pool = [
      ...artistTracks,
      ...Object.values(playlistCache).flatMap((d) => d.entries.map((e) => e.track)),
    ]
    return recommend({ history, favorites, pool, now })
  }, [artistTracks, playlistCache, history, favorites, now])
}
