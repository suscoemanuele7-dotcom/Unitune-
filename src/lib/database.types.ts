/**
 * Tipi del database, nel formato prodotto da `supabase gen types typescript`.
 * Rigenerabili con:
 *   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 * (scritti a mano qui perché devono corrispondere alla migrazione iniziale).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type TrackColumns = {
  source: 'youtube' | 'audius'
  track_id: string
  title: string
  channel_title: string
  thumbnail_url: string
  external_url: string
  duration_sec: number | null
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; created_at: string }
        Insert: { id: string; display_name?: string; created_at?: string }
        Update: { display_name?: string }
        Relationships: []
      }
      playlists: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string
          is_public: boolean
          is_university: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string
          name: string
          description?: string
          is_public?: boolean
          is_university?: boolean
        }
        Update: { name?: string; description?: string; is_public?: boolean; is_university?: boolean }
        Relationships: []
      }
      playlist_tracks: {
        Row: TrackColumns & { id: string; playlist_id: string; position: number; added_by: string | null; added_at: string }
        Insert: Partial<TrackColumns> &
          Pick<TrackColumns, 'track_id' | 'title'> & { playlist_id: string; position: number }
        Update: { position?: number }
        Relationships: []
      }
      playlist_saves: {
        Row: { user_id: string; playlist_id: string; saved_at: string }
        Insert: { playlist_id: string; user_id?: string }
        Update: Record<string, never>
        Relationships: []
      }
      favorites: {
        Row: TrackColumns & { user_id: string; created_at: string }
        Insert: Partial<TrackColumns> & Pick<TrackColumns, 'track_id' | 'title'> & { user_id?: string }
        Update: Record<string, never>
        Relationships: []
      }
      history: {
        Row: TrackColumns & { id: number; user_id: string; played_at: string }
        Insert: Partial<TrackColumns> & Pick<TrackColumns, 'track_id' | 'title'> & { user_id?: string }
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: {
      playlist_summaries: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string
          is_public: boolean
          is_university: boolean
          created_at: string
          updated_at: string
          owner_name: string
          track_count: number
          cover_urls: string[]
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
