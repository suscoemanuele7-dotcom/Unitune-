/**
 * Stato della libreria dell'utente (playlist, preferiti, cronologia).
 *
 * Persistito in localStorage: all'avvio offline l'app mostra l'ultima
 * sessione (requisito "offline: shell + ultima sessione UI"). Le scritture
 * vanno al repository (Supabase o locale) con aggiornamento ottimistico.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { AppUser } from '../auth/useAuthStore'
import type {
  FavoriteEntry,
  HistoryEntry,
  PlaylistDetail,
  PlaylistInput,
  PlaylistSummary,
  Track,
} from '../types'
import { DataError, type DataErrorCode, type DataRepository } from './repository'
import { LocalRepository } from './localRepository'
import { SupabaseRepository } from './supabaseRepository'

let repo: DataRepository | null = null

function repository(): DataRepository {
  if (!repo) throw new DataError('unauthorized', 'Nessun utente collegato')
  return repo
}

function errorCode(error: unknown): DataErrorCode {
  return error instanceof DataError ? error.code : navigator.onLine ? 'unknown' : 'offline'
}

const HISTORY_LIMIT = 50
const PLAYLIST_CACHE_MAX = 20

interface LibraryState {
  ownerId: string | null
  myPlaylists: PlaylistSummary[]
  savedPlaylists: PlaylistSummary[]
  universityPlaylists: PlaylistSummary[]
  favorites: FavoriteEntry[]
  history: HistoryEntry[]
  /** Ultime playlist aperte, per consultarle offline. */
  playlistCache: Record<string, PlaylistDetail>
  /** Ascolti registrati offline, da inviare appena torna la rete. */
  pendingHistory: Track[]
  loading: boolean
  lastError: DataErrorCode | null

  bindUser: (user: AppUser | null) => void
  refresh: () => Promise<void>
  loadPlaylist: (id: string) => Promise<PlaylistDetail>
  toggleFavorite: (track: Track) => Promise<boolean>
  recordPlay: (track: Track) => Promise<void>
  clearHistory: () => Promise<void>
  createPlaylist: (input: PlaylistInput) => Promise<PlaylistSummary>
  updatePlaylist: (id: string, input: PlaylistInput) => Promise<void>
  deletePlaylist: (id: string) => Promise<void>
  addToPlaylist: (playlistId: string, track: Track) => Promise<void>
  removeFromPlaylist: (playlistId: string, entryId: string) => Promise<void>
  setSaved: (playlistId: string, saved: boolean) => Promise<void>
}

const empty = {
  myPlaylists: [],
  savedPlaylists: [],
  universityPlaylists: [],
  favorites: [],
  history: [],
  playlistCache: {},
  pendingHistory: [],
  loading: false,
  lastError: null,
} satisfies Partial<LibraryState>

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => {
      /** Esegue una scrittura; in caso di errore ripristina lo stato e rilancia. */
      async function write(apply: () => void, run: () => Promise<void>): Promise<void> {
        const snapshot = get()
        apply()
        try {
          await run()
        } catch (error) {
          set({
            myPlaylists: snapshot.myPlaylists,
            savedPlaylists: snapshot.savedPlaylists,
            favorites: snapshot.favorites,
            history: snapshot.history,
          })
          throw error
        }
      }

      function cacheDetail(detail: PlaylistDetail) {
        const cache = { ...get().playlistCache, [detail.summary.id]: detail }
        const ids = Object.keys(cache)
        if (ids.length > PLAYLIST_CACHE_MAX) {
          const oldest = ids
            .map((id) => cache[id])
            .filter((d): d is PlaylistDetail => d !== undefined)
            .sort((a, b) => a.summary.updatedAt.localeCompare(b.summary.updatedAt))[0]
          if (oldest) {
            const { [oldest.summary.id]: _removed, ...rest } = cache
            set({ playlistCache: rest })
            return
          }
        }
        set({ playlistCache: cache })
      }

      return {
        ownerId: null,
        ...empty,

        bindUser(user) {
          if (!user) {
            repo = null
            set({ ownerId: null, ...empty })
            return
          }
          repo = supabase ? new SupabaseRepository(supabase, user.id) : new LocalRepository(user.id, user.displayName)
          // Dati in cache di un altro utente: li scartiamo.
          if (get().ownerId !== user.id) set({ ownerId: user.id, ...empty })
        },

        async refresh() {
          set({ loading: true })
          try {
            const r = repository()
            const pending = get().pendingHistory
            if (pending.length > 0) {
              for (const track of pending) await r.addHistory(track)
              set({ pendingHistory: [] })
            }
            const [myPlaylists, savedPlaylists, universityPlaylists, favorites, history] = await Promise.all([
              r.listMyPlaylists(),
              r.listSavedPlaylists(),
              r.listUniversityPlaylists(),
              r.listFavorites(),
              r.listHistory(HISTORY_LIMIT),
            ])
            set({ myPlaylists, savedPlaylists, universityPlaylists, favorites, history, lastError: null })
          } catch (error) {
            set({ lastError: errorCode(error) })
          } finally {
            set({ loading: false })
          }
        },

        async loadPlaylist(id) {
          try {
            const detail = await repository().getPlaylist(id)
            cacheDetail(detail)
            return detail
          } catch (error) {
            const cached = get().playlistCache[id]
            if (cached && errorCode(error) === 'offline') return cached
            throw error
          }
        },

        async toggleFavorite(track) {
          const isFav = get().favorites.some((f) => f.track.videoId === track.videoId)
          await write(
            () => {
              set({
                favorites: isFav
                  ? get().favorites.filter((f) => f.track.videoId !== track.videoId)
                  : [{ track, createdAt: new Date().toISOString() }, ...get().favorites],
              })
            },
            () => (isFav ? repository().removeFavorite(track.videoId) : repository().addFavorite(track)),
          )
          return !isFav
        },

        async recordPlay(track) {
          const entry: HistoryEntry = { id: `local-${Date.now()}`, track, playedAt: new Date().toISOString() }
          set({ history: [entry, ...get().history].slice(0, HISTORY_LIMIT) })
          try {
            await repository().addHistory(track)
          } catch (error) {
            // Offline: lo registriamo più tardi, senza disturbare l'ascolto.
            if (errorCode(error) === 'offline') set({ pendingHistory: [...get().pendingHistory, track].slice(-100) })
          }
        },

        async clearHistory() {
          await write(
            () => {
              set({ history: [] })
            },
            () => repository().clearHistory(),
          )
        },

        async createPlaylist(input) {
          const created = await repository().createPlaylist(input)
          set({ myPlaylists: [created, ...get().myPlaylists] })
          if (created.isUniversity) set({ universityPlaylists: [created, ...get().universityPlaylists] })
          return created
        },

        async updatePlaylist(id, input) {
          await repository().updatePlaylist(id, input)
          await get().refresh()
        },

        async deletePlaylist(id) {
          await write(
            () => {
              const { [id]: _removed, ...cache } = get().playlistCache
              set({
                myPlaylists: get().myPlaylists.filter((p) => p.id !== id),
                universityPlaylists: get().universityPlaylists.filter((p) => p.id !== id),
                playlistCache: cache,
              })
            },
            () => repository().deletePlaylist(id),
          )
        },

        async addToPlaylist(playlistId, track) {
          await repository().addTrackToPlaylist(playlistId, track)
          const bump = (list: PlaylistSummary[]) =>
            list.map((p) =>
              p.id === playlistId
                ? {
                    ...p,
                    trackCount: p.trackCount + 1,
                    coverUrls: p.coverUrls.length < 4 ? [...p.coverUrls, track.thumbnailUrl] : p.coverUrls,
                    updatedAt: new Date().toISOString(),
                  }
                : p,
            )
          const { [playlistId]: _stale, ...cache } = get().playlistCache
          set({
            myPlaylists: bump(get().myPlaylists),
            universityPlaylists: bump(get().universityPlaylists),
            playlistCache: cache,
          })
        },

        async removeFromPlaylist(playlistId, entryId) {
          await repository().removeTrackFromPlaylist(playlistId, entryId)
          await get().loadPlaylist(playlistId)
          set({
            myPlaylists: get().myPlaylists.map((p) =>
              p.id === playlistId ? { ...p, trackCount: Math.max(0, p.trackCount - 1) } : p,
            ),
          })
        },

        async setSaved(playlistId, saved) {
          await repository().setPlaylistSaved(playlistId, saved)
          const cached = get().playlistCache[playlistId]
          if (cached) cacheDetail({ ...cached, isSaved: saved })
          set({ savedPlaylists: await repository().listSavedPlaylists() })
        },
      }
    },
    {
      name: 'unitune.library.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        ownerId: s.ownerId,
        myPlaylists: s.myPlaylists,
        savedPlaylists: s.savedPlaylists,
        universityPlaylists: s.universityPlaylists,
        favorites: s.favorites,
        history: s.history,
        playlistCache: s.playlistCache,
        pendingHistory: s.pendingHistory,
      }),
    },
  ),
)

export function useIsFavorite(videoId: string | undefined): boolean {
  return useLibraryStore((s) => videoId !== undefined && s.favorites.some((f) => f.track.videoId === videoId))
}
