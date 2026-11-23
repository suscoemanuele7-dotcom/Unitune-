/**
 * Accesso a Supabase (Auth + PostgREST) via semplice fetch, senza SDK:
 * nessuna dipendenza esterna nella funzione.
 */
import type { CachedSearch, HandlerDeps } from './handler.ts'

export interface SupabaseRestConfig {
  url: string
  anonKey: string
  serviceRoleKey: string
  maxSearchesPerUserPerDay: number
  fetch: typeof fetch
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Le nuove chiavi `sb_secret_…` non sono JWT: vanno solo nell'header apikey. */
function serviceHeaders(key: string): Record<string, string> {
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` }
}

export function createSupabaseDeps(
  cfg: SupabaseRestConfig,
): Pick<HandlerDeps, 'authenticate' | 'consumeUserQuota' | 'cache'> {
  const rest = `${cfg.url}/rest/v1`
  const service = serviceHeaders(cfg.serviceRoleKey)

  return {
    async authenticate(authorization) {
      const res = await cfg.fetch(`${cfg.url}/auth/v1/user`, {
        headers: { apikey: cfg.anonKey, Authorization: authorization },
      })
      if (!res.ok) return null
      const user: unknown = await res.json()
      return isRecord(user) && typeof user.id === 'string' ? user.id : null
    },

    async consumeUserQuota(userId) {
      const res = await cfg.fetch(`${rest}/rpc/consume_search_quota`, {
        method: 'POST',
        headers: { ...service, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_user: userId, p_max: cfg.maxSearchesPerUserPerDay }),
      })
      if (!res.ok) throw new Error(`consume_search_quota HTTP ${res.status}`)
      const allowed: unknown = await res.json()
      return allowed === true
    },

    cache: {
      async get(key) {
        const params = new URLSearchParams({
          key: `eq.${key}`,
          expires_at: `gt.${new Date().toISOString()}`,
          select: 'payload',
        })
        const res = await cfg.fetch(`${rest}/yt_cache?${params.toString()}`, { headers: service })
        if (!res.ok) throw new Error(`yt_cache GET HTTP ${res.status}`)
        const rows: unknown = await res.json()
        if (!Array.isArray(rows) || !isRecord(rows[0])) return null
        const payload = rows[0].payload
        if (!isRecord(payload) || !Array.isArray(payload.items)) return null
        return payload as unknown as CachedSearch
      },
      async set(key, value, ttlSec) {
        const res = await cfg.fetch(`${rest}/yt_cache`, {
          method: 'POST',
          headers: { ...service, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({
            key,
            payload: value,
            expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
          }),
        })
        if (!res.ok) throw new Error(`yt_cache POST HTTP ${res.status}`)
      },
    },
  }
}
