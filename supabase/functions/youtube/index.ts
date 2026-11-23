/**
 * Edge Function `youtube` — ricerca brani tramite YouTube Data API v3.
 *
 * Deploy:   supabase functions deploy youtube
 * Secret:   supabase secrets set YOUTUBE_API_KEY=... ALLOWED_ORIGINS=https://tuo-dominio.app
 * Variabili SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
 * sono fornite automaticamente da Supabase.
 */
import { createHandler } from '../_shared/handler.ts'
import { createSupabaseDeps } from '../_shared/supabase-rest.ts'

function required(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`)
  return value
}

function intEnv(name: string, fallback: number): number {
  const n = Number(Deno.env.get(name))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

const supabase = createSupabaseDeps({
  url: required('SUPABASE_URL'),
  anonKey: required('SUPABASE_ANON_KEY'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  maxSearchesPerUserPerDay: intEnv('YT_MAX_SEARCHES_PER_USER_DAY', 40),
  fetch,
})

const handler = createHandler({
  ...supabase,
  apiKey: Deno.env.get('YOUTUBE_API_KEY'),
  fetch,
  allowedOrigins: (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  regionCode: Deno.env.get('YT_REGION_CODE') ?? 'IT',
  relevanceLanguage: Deno.env.get('YT_RELEVANCE_LANGUAGE') ?? 'it',
  // Le Developer Policies consentono di conservare i dati API al massimo 30 giorni.
  cacheTtlSec: Math.min(intEnv('YT_CACHE_TTL_HOURS', 24), 720) * 3600,
  now: () => new Date(),
  log: (message, error) => {
    console.error(`[youtube] ${message}`, error ?? '')
  },
})

Deno.serve(handler)
