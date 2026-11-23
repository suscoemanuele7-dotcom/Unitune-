import type {
  FavoriteEntry,
  HistoryEntry,
  PlaylistDetail,
  PlaylistInput,
  PlaylistSummary,
  Track,
} from '../types'

export type DataErrorCode = 'offline' | 'unauthorized' | 'forbidden' | 'not_found' | 'invalid' | 'unknown'

export class DataError extends Error {
  readonly code: DataErrorCode
  constructor(code: DataErrorCode, message: string) {
    super(message)
    this.name = 'DataError'
    this.code = code
  }
}

/**
 * Accesso ai dati dell'utente. Due implementazioni intercambiabili:
 * - SupabaseRepository (Postgres + RLS);
 * - LocalRepository (modalità demo, localStorage del dispositivo).
 */
export interface DataRepository {
  listMyPlaylists(): Promise<PlaylistSummary[]>
  listSavedPlaylists(): Promise<PlaylistSummary[]>
  listUniversityPlaylists(): Promise<PlaylistSummary[]>
  getPlaylist(id: string): Promise<PlaylistDetail>
  createPlaylist(input: PlaylistInput): Promise<PlaylistSummary>
  updatePlaylist: (id: string, input: PlaylistInput) => Promise<void>
  deletePlaylist: (id: string) => Promise<void>
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>
  removeTrackFromPlaylist: (playlistId: string, entryId: string) => Promise<void>
  setPlaylistSaved: (playlistId: string, saved: boolean) => Promise<void>

  listFavorites(): Promise<FavoriteEntry[]>
  addFavorite: (track: Track) => Promise<void>
  removeFavorite: (videoId: string) => Promise<void>

  listHistory(limit: number): Promise<HistoryEntry[]>
  addHistory: (track: Track) => Promise<void>
  clearHistory: () => Promise<void>
}
