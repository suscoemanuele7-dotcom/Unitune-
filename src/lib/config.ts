/**
 * Configurazione derivata dalle variabili d'ambiente.
 *
 * - backend "supabase": VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY presenti.
 * - backend "local" (modalità demo): nessuna configurazione; i dati restano
 *   nel localStorage del dispositivo. Utile per provare l'app subito.
 *
 * La ricerca reale passa dalla Edge Function di Supabase, quindi senza
 * Supabase si usano per forza i dati dimostrativi.
 */
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const supabaseConfigured = supabaseUrl.startsWith('http') && supabaseAnonKey.length > 0

export const config = {
  backend: supabaseConfigured ? ('supabase' as const) : ('local' as const),
  supabaseUrl,
  supabaseAnonKey,
  useMockYouTube: !supabaseConfigured || import.meta.env.VITE_USE_MOCKS === 'true',
}

export type Backend = (typeof config)['backend']
