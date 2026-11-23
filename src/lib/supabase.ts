import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'
import type { Database } from './database.types'

export type AppSupabaseClient = SupabaseClient<Database>

/**
 * Client Supabase, o null in modalità demo (backend locale).
 * La anon key è pubblica per design: la sicurezza è garantita dalle policy
 * RLS definite in supabase/migrations.
 */
export const supabase: AppSupabaseClient | null =
  config.backend === 'supabase'
    ? createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          // PKCE: il magic link torna all'app con un `code` che il client
          // scambia automaticamente per una sessione.
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null
