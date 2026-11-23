/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** "true" per usare i mock MSW al posto della YouTube Data API. */
  readonly VITE_USE_MOCKS?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
