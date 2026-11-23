import type { TrackDTO, TrackSource } from '../supabase/functions/_shared/contract.ts'

/** Un brano = metadati pubblici (YouTube o Audius), nessun file audio. */
export type Track = TrackDTO
export type { TrackSource }

export interface PlaylistSummary {
  id: string
  ownerId: string
  ownerName: string
  name: string
  description: string
  isPublic: boolean
  isUniversity: boolean
  trackCount: number
  /** Fino a 4 thumbnail per la copertina a mosaico. */
  coverUrls: string[]
  createdAt: string
  updatedAt: string
}

export interface PlaylistEntry {
  /** ID della riga in playlist_tracks (lo stesso video può comparire più volte). */
  entryId: string
  track: Track
  position: number
  addedAt: string
}

export interface PlaylistDetail {
  summary: PlaylistSummary
  entries: PlaylistEntry[]
  /** Per playlist di altri: salvata nella mia libreria? */
  isSaved: boolean
}

export interface HistoryEntry {
  id: string
  track: Track
  playedAt: string
}

export interface FavoriteEntry {
  track: Track
  createdAt: string
}

export interface PlaylistInput {
  name: string
  description: string
  isPublic: boolean
  isUniversity: boolean
}
