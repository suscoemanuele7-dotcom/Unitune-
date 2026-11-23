import type { PostgrestError } from '@supabase/supabase-js'
import type { AppSupabaseClient } from '../lib/supabase'
import type { Database } from '../lib/database.types'
import type { FavoriteEntry, HistoryEntry, PlaylistDetail, PlaylistInput, PlaylistSummary, Track } from '../types'
import { DataError, type DataRepository } from './repository'

type SummaryRow = Database['public']['Views']['playlist_summaries']['Row']
type TrackRow = Pick<
  Database['public']['Tables']['favorites']['Row'],
  'source' | 'track_id' | 'title' | 'channel_title' | 'thumbnail_url' | 'external_url' | 'duration_sec'
>

function toSummary(r: SummaryRow): PlaylistSummary {
  return {
    id: r.id,
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    name: r.name,
    description: r.description,
    isPublic: r.is_public,
    isUniversity: r.is_university,
    trackCount: r.track_count,
    coverUrls: r.cover_urls.filter(Boolean),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function toTrack(r: TrackRow): Track {
  return {
    source: r.source,
    id: r.track_id,
    title: r.title,
    channelTitle: r.channel_title,
    thumbnailUrl: r.thumbnail_url,
    durationSec: r.duration_sec,
    externalUrl: r.external_url,
  }
}

function trackColumns(t: Track): TrackRow {
  return {
    source: t.source,
    track_id: t.id,
    title: t.title,
    channel_title: t.channelTitle,
    thumbnail_url: t.thumbnailUrl,
    external_url: t.externalUrl,
    duration_sec: t.durationSec,
  }
}

/** Traduce gli errori di PostgREST/rete in DataError. */
function toDataError(error: PostgrestError): DataError {
  if (!navigator.onLine || /failed to fetch|network/i.test(error.message)) {
    return new DataError('offline', 'Connessione assente')
  }
  if (error.code === 'PGRST301' || error.code === '401') return new DataError('unauthorized', error.message)
  if (error.code === '42501') return new DataError('forbidden', error.message)
  if (error.code === '23514' || error.code === '22P02' || error.code === '23505') {
    return new DataError('invalid', error.message)
  }
  return new DataError('unknown', error.message)
}

/** Query che restituisce dati: errore → DataError, null → errore. */
function check<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw toDataError(result.error)
  if (result.data === null) throw new DataError('unknown', 'Risposta vuota dal database')
  return result.data
}

/** Query con `.maybeSingle()`: null significa "nessuna riga". */
function checkMaybe<T>(result: { data: T | null; error: PostgrestError | null }): T | null {
  if (result.error) throw toDataError(result.error)
  return result.data
}

/** Scritture senza dati di ritorno. */
function checkOk(result: { error: PostgrestError | null }): void {
  if (result.error) throw toDataError(result.error)
}

const TRACK_COLUMNS = 'source, track_id, title, channel_title, thumbnail_url, external_url, duration_sec'

const SUMMARY_COLUMNS =
  'id, owner_id, name, description, is_public, is_university, created_at, updated_at, owner_name, track_count, cover_urls'

export class SupabaseRepository implements DataRepository {
  private readonly db: AppSupabaseClient
  private readonly userId: string

  constructor(db: AppSupabaseClient, userId: string) {
    this.db = db
    this.userId = userId
  }

  async listMyPlaylists() {
    const rows = check(
      await this.db
        .from('playlist_summaries')
        .select(SUMMARY_COLUMNS)
        .eq('owner_id', this.userId)
        .order('updated_at', { ascending: false }),
    )
    return rows.map(toSummary)
  }

  async listSavedPlaylists() {
    const saves = check(
      await this.db.from('playlist_saves').select('playlist_id').order('saved_at', { ascending: false }),
    )
    if (saves.length === 0) return []
    const ids = saves.map((s) => s.playlist_id)
    const rows = check(await this.db.from('playlist_summaries').select(SUMMARY_COLUMNS).in('id', ids))
    const byId = new Map(rows.map((r) => [r.id, toSummary(r)]))
    return ids.flatMap((id) => {
      const s = byId.get(id)
      return s ? [s] : []
    })
  }

  async listUniversityPlaylists() {
    const rows = check(
      await this.db
        .from('playlist_summaries')
        .select(SUMMARY_COLUMNS)
        .eq('is_university', true)
        .order('updated_at', { ascending: false })
        .limit(20),
    )
    return rows.map(toSummary)
  }

  async getPlaylist(id: string): Promise<PlaylistDetail> {
    const [summary, tracks, saved] = await Promise.all([
      this.db.from('playlist_summaries').select(SUMMARY_COLUMNS).eq('id', id).maybeSingle(),
      this.db
        .from('playlist_tracks')
        .select(`id, ${TRACK_COLUMNS}, position, added_at`)
        .eq('playlist_id', id)
        .order('position')
        .order('added_at'),
      this.db.from('playlist_saves').select('playlist_id').eq('playlist_id', id).maybeSingle(),
    ])
    const s = checkMaybe(summary)
    if (!s) throw new DataError('not_found', 'Playlist non trovata o privata')
    return {
      summary: toSummary(s),
      entries: check(tracks).map((r) => ({ entryId: r.id, track: toTrack(r), position: r.position, addedAt: r.added_at })),
      isSaved: checkMaybe(saved) !== null,
    }
  }

  async createPlaylist(input: PlaylistInput) {
    const created = check<{ id: string }>(
      await this.db
        .from('playlists')
        .insert({
          name: input.name.trim(),
          description: input.description.trim(),
          is_public: input.isPublic || input.isUniversity,
          is_university: input.isUniversity,
        })
        .select('id')
        .single(),
    )
    return (await this.getPlaylist(created.id)).summary
  }

  async updatePlaylist(id: string, input: PlaylistInput) {
    checkOk(
      await this.db
        .from('playlists')
        .update({
          name: input.name.trim(),
          description: input.description.trim(),
          is_public: input.isPublic || input.isUniversity,
          is_university: input.isUniversity,
        })
        .eq('id', id),
    )
  }

  async deletePlaylist(id: string) {
    checkOk(await this.db.from('playlists').delete().eq('id', id))
  }

  async addTrackToPlaylist(playlistId: string, track: Track) {
    const last = checkMaybe<{ position: number }>(
      await this.db
        .from('playlist_tracks')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle(),
    )
    checkOk(
      await this.db
        .from('playlist_tracks')
        .insert({ ...trackColumns(track), playlist_id: playlistId, position: (last?.position ?? -1) + 1 }),
    )
  }

  async removeTrackFromPlaylist(playlistId: string, entryId: string) {
    checkOk(await this.db.from('playlist_tracks').delete().eq('id', entryId).eq('playlist_id', playlistId))
  }

  async setPlaylistSaved(playlistId: string, saved: boolean) {
    if (saved) {
      checkOk(await this.db.from('playlist_saves').upsert({ playlist_id: playlistId }, { ignoreDuplicates: true }))
    } else {
      checkOk(await this.db.from('playlist_saves').delete().eq('playlist_id', playlistId).eq('user_id', this.userId))
    }
  }

  async listFavorites(): Promise<FavoriteEntry[]> {
    const rows = check(
      await this.db
        .from('favorites')
        .select(`${TRACK_COLUMNS}, created_at`)
        .order('created_at', { ascending: false }),
    )
    return rows.map((r) => ({ track: toTrack(r), createdAt: r.created_at }))
  }

  async addFavorite(track: Track) {
    checkOk(await this.db.from('favorites').upsert(trackColumns(track), { onConflict: 'user_id,source,track_id' }))
  }

  async removeFavorite(track: Track) {
    checkOk(
      await this.db
        .from('favorites')
        .delete()
        .eq('user_id', this.userId)
        .eq('source', track.source)
        .eq('track_id', track.id),
    )
  }

  async listHistory(limit: number): Promise<HistoryEntry[]> {
    const rows = check(
      await this.db
        .from('history')
        .select(`id, ${TRACK_COLUMNS}, played_at`)
        .order('played_at', { ascending: false })
        .limit(limit),
    )
    return rows.map((r) => ({ id: String(r.id), track: toTrack(r), playedAt: r.played_at }))
  }

  async addHistory(track: Track) {
    checkOk(await this.db.from('history').insert(trackColumns(track)))
  }

  async clearHistory() {
    checkOk(await this.db.from('history').delete().eq('user_id', this.userId))
  }
}
