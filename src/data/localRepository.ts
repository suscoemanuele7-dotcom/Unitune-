/**
 * Backend "modalità demo": stessi metodi del repository Supabase, ma i dati
 * vivono nel localStorage di questo dispositivo. Nessun account necessario.
 */
import { demoUniversityPlaylists } from '../api/fixtures'
import { isRecord, readJson, writeJson } from '../lib/storage'
import type { FavoriteEntry, HistoryEntry, PlaylistDetail, PlaylistInput, PlaylistSummary, Track } from '../types'
import { DataError, type DataRepository } from './repository'

interface StoredPlaylist {
  id: string
  ownerId: string
  ownerName: string
  name: string
  description: string
  isPublic: boolean
  isUniversity: boolean
  createdAt: string
  updatedAt: string
  entries: { entryId: string; track: Track; position: number; addedAt: string }[]
}

interface LocalDb {
  version: 1
  playlists: StoredPlaylist[]
  saves: string[]
  favorites: FavoriteEntry[]
  history: HistoryEntry[]
}

const DB_KEY = 'unitune.localdb.v1'
const CURATOR_ID = 'demo-ateneo'
const HISTORY_MAX = 200

function isLocalDb(v: unknown): v is LocalDb {
  return (
    isRecord(v) &&
    v.version === 1 &&
    Array.isArray(v.playlists) &&
    Array.isArray(v.saves) &&
    Array.isArray(v.favorites) &&
    Array.isArray(v.history)
  )
}

function uid(): string {
  return crypto.randomUUID()
}

function seed(): LocalDb {
  const now = new Date().toISOString()
  return {
    version: 1,
    playlists: demoUniversityPlaylists.map((p) => ({
      id: p.id,
      ownerId: CURATOR_ID,
      ownerName: 'Ateneo (demo)',
      name: p.name,
      description: p.description,
      isPublic: true,
      isUniversity: true,
      createdAt: now,
      updatedAt: now,
      entries: p.tracks.map((track, i) => ({ entryId: uid(), track, position: i, addedAt: now })),
    })),
    saves: [],
    favorites: [],
    history: [],
  }
}

function summarize(p: StoredPlaylist): PlaylistSummary {
  const ordered = [...p.entries].sort((a, b) => a.position - b.position)
  return {
    id: p.id,
    ownerId: p.ownerId,
    ownerName: p.ownerName,
    name: p.name,
    description: p.description,
    isPublic: p.isPublic,
    isUniversity: p.isUniversity,
    trackCount: p.entries.length,
    coverUrls: ordered.slice(0, 4).map((e) => e.track.thumbnailUrl),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

const byUpdatedDesc = (a: PlaylistSummary, b: PlaylistSummary) => b.updatedAt.localeCompare(a.updatedAt)

export class LocalRepository implements DataRepository {
  private readonly userId: string
  private readonly userName: string

  constructor(userId: string, userName: string) {
    this.userId = userId
    this.userName = userName
  }

  private load(): LocalDb {
    const db = readJson(DB_KEY, isLocalDb)
    if (db) return db
    const fresh = seed()
    writeJson(DB_KEY, fresh)
    return fresh
  }

  private save(db: LocalDb): void {
    if (!writeJson(DB_KEY, db)) throw new DataError('unknown', 'Spazio di archiviazione del dispositivo esaurito')
  }

  private mutate<T>(fn: (db: LocalDb) => T): Promise<T> {
    const db = this.load()
    const result = fn(db)
    this.save(db)
    return Promise.resolve(result)
  }

  private ownPlaylist(db: LocalDb, id: string): StoredPlaylist {
    const p = db.playlists.find((x) => x.id === id)
    if (!p) throw new DataError('not_found', 'Playlist non trovata')
    if (p.ownerId !== this.userId) throw new DataError('forbidden', 'Non puoi modificare questa playlist')
    return p
  }

  listMyPlaylists() {
    const db = this.load()
    return Promise.resolve(db.playlists.filter((p) => p.ownerId === this.userId).map(summarize).sort(byUpdatedDesc))
  }

  listSavedPlaylists() {
    const db = this.load()
    return Promise.resolve(
      db.saves.flatMap((id) => {
        const p = db.playlists.find((x) => x.id === id)
        return p && p.isPublic ? [summarize(p)] : []
      }),
    )
  }

  listUniversityPlaylists() {
    const db = this.load()
    return Promise.resolve(db.playlists.filter((p) => p.isUniversity).map(summarize).sort(byUpdatedDesc))
  }

  getPlaylist(id: string): Promise<PlaylistDetail> {
    const db = this.load()
    const p = db.playlists.find((x) => x.id === id)
    if (!p || (p.ownerId !== this.userId && !p.isPublic)) {
      return Promise.reject(new DataError('not_found', 'Playlist non trovata o privata'))
    }
    return Promise.resolve({
      summary: summarize(p),
      entries: [...p.entries].sort((a, b) => a.position - b.position),
      isSaved: db.saves.includes(id),
    })
  }

  createPlaylist(input: PlaylistInput) {
    return this.mutate((db) => {
      const now = new Date().toISOString()
      const p: StoredPlaylist = {
        id: uid(),
        ownerId: this.userId,
        ownerName: this.userName,
        name: input.name.trim(),
        description: input.description.trim(),
        isPublic: input.isPublic || input.isUniversity,
        isUniversity: input.isUniversity,
        createdAt: now,
        updatedAt: now,
        entries: [],
      }
      db.playlists.push(p)
      return summarize(p)
    })
  }

  updatePlaylist(id: string, input: PlaylistInput) {
    return this.mutate((db) => {
      const p = this.ownPlaylist(db, id)
      p.name = input.name.trim()
      p.description = input.description.trim()
      p.isPublic = input.isPublic || input.isUniversity
      p.isUniversity = input.isUniversity
      p.updatedAt = new Date().toISOString()
    })
  }

  deletePlaylist(id: string) {
    return this.mutate((db) => {
      this.ownPlaylist(db, id)
      db.playlists = db.playlists.filter((p) => p.id !== id)
      db.saves = db.saves.filter((s) => s !== id)
    })
  }

  addTrackToPlaylist(playlistId: string, track: Track) {
    return this.mutate((db) => {
      const p = this.ownPlaylist(db, playlistId)
      const position = p.entries.reduce((max, e) => Math.max(max, e.position), -1) + 1
      const now = new Date().toISOString()
      p.entries.push({ entryId: uid(), track, position, addedAt: now })
      p.updatedAt = now
    })
  }

  removeTrackFromPlaylist(playlistId: string, entryId: string) {
    return this.mutate((db) => {
      const p = this.ownPlaylist(db, playlistId)
      p.entries = p.entries.filter((e) => e.entryId !== entryId)
      p.updatedAt = new Date().toISOString()
    })
  }

  setPlaylistSaved(playlistId: string, saved: boolean) {
    return this.mutate((db) => {
      db.saves = db.saves.filter((s) => s !== playlistId)
      if (saved) db.saves.unshift(playlistId)
    })
  }

  listFavorites() {
    return Promise.resolve(this.load().favorites)
  }

  addFavorite(track: Track) {
    return this.mutate((db) => {
      db.favorites = [
        { track, createdAt: new Date().toISOString() },
        ...db.favorites.filter((f) => f.track.videoId !== track.videoId),
      ]
    })
  }

  removeFavorite(videoId: string) {
    return this.mutate((db) => {
      db.favorites = db.favorites.filter((f) => f.track.videoId !== videoId)
    })
  }

  listHistory(limit: number) {
    return Promise.resolve(this.load().history.slice(0, limit))
  }

  addHistory(track: Track) {
    return this.mutate((db) => {
      db.history = [{ id: uid(), track, playedAt: new Date().toISOString() }, ...db.history].slice(0, HISTORY_MAX)
    })
  }

  clearHistory() {
    return this.mutate((db) => {
      db.history = []
    })
  }
}
