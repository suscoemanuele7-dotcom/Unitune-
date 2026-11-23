import { config } from '../lib/config'
import { supabase } from '../lib/supabase'
import { isRecord, readJson, removeKey, writeJson } from '../lib/storage'
import { EdgeFunctionYouTubeClient, MockYouTubeClient, type CooldownState, type YouTubeClient } from './youtube'

const COOLDOWN_KEY = 'unitune.yt.cooldown'

function isCooldown(v: unknown): v is CooldownState {
  return (
    isRecord(v) &&
    (v.code === 'quota_exceeded' || v.code === 'user_quota_exceeded') &&
    typeof v.until === 'number'
  )
}

function createClient(): YouTubeClient {
  if (config.useMockYouTube || !supabase) return new MockYouTubeClient()
  const client = supabase
  return new EdgeFunctionYouTubeClient({
    functionUrl: `${config.supabaseUrl}/functions/v1/youtube`,
    anonKey: config.supabaseAnonKey,
    getAccessToken: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    isOnline: () => navigator.onLine,
    cooldownStore: {
      get: () => readJson(COOLDOWN_KEY, isCooldown),
      set: (value) => {
        if (value) writeJson(COOLDOWN_KEY, value)
        else removeKey(COOLDOWN_KEY)
      },
    },
  })
}

/** Istanza unica usata dall'app. */
export const youtube: YouTubeClient = createClient()
