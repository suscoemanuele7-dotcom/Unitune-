/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** "true" per usare i mock MSW al posto della YouTube Data API. */
  readonly VITE_USE_MOCKS?: 'true' | 'false'
  /** Base dell'API Audius (default https://api.audius.co/v1). */
  readonly VITE_AUDIUS_API?: string
  /** Nome dell'app comunicato ad Audius (parametro app_name). */
  readonly VITE_AUDIUS_APP_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
