import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { youtube } from '../api/client'
import { isQuotaError, normalizeQuery, YouTubeApiError } from '../api/youtube'
import { ErrorNotice, PageHeader, Spinner } from '../components/common'
import { TrackRow } from '../components/TrackRow'
import { ClockIcon, CloseIcon, SearchIcon } from '../components/icons'
import { errorMessage } from '../lib/errors'
import { readJson, writeJson } from '../lib/storage'
import { usePlayerStore } from '../player/usePlayerStore'
import type { Track } from '../types'
import { t } from '../i18n'

const MIN_CHARS = 2
const DEBOUNCE_MS = 450
const RECENT_KEY = 'unitune.search.recent'

interface SearchState {
  query: string
  submitted: string
  items: Track[]
  nextPageToken: string | null
  status: 'idle' | 'loading' | 'done' | 'error'
  error: unknown
  /** Incrementato da "Riprova" per rieseguire la stessa ricerca. */
  attempt: number
}

/** Stato della ricerca mantenuto tra un cambio pagina e l'altro. */
const useSearchState = create<SearchState & { patch: (p: Partial<SearchState>) => void }>()((set) => ({
  query: '',
  submitted: '',
  items: [],
  nextPageToken: null,
  status: 'idle',
  error: null,
  attempt: 0,
  patch: (p) => {
    set(p)
  },
}))

function loadRecent(): string[] {
  return readJson(RECENT_KEY, (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')) ?? []
}

export function SearchPage() {
  const { query, submitted, items, nextPageToken, status, error, attempt, patch } = useSearchState()
  const [recent, setRecent] = useState(loadRecent)
  const [loadingMore, setLoadingMore] = useState(false)
  const playTracks = usePlayerStore((s) => s.playTracks)
  const inputRef = useRef<HTMLInputElement>(null)

  const normalized = normalizeQuery(query)

  // Ricerca con debounce: si parte solo quando l'utente smette di scrivere.
  useEffect(() => {
    if (normalized.length < MIN_CHARS || normalized === useSearchState.getState().submitted) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      patch({ status: 'loading', error: null, submitted: normalized })
      youtube
        .search(normalized, { signal: controller.signal })
        .then((result) => {
          patch({ items: result.items, nextPageToken: result.nextPageToken, status: 'done' })
          const updated = [normalized, ...loadRecent().filter((r) => r !== normalized)].slice(0, 8)
          writeJson(RECENT_KEY, updated)
          setRecent(updated)
        })
        .catch((err: unknown) => {
          if (err instanceof YouTubeApiError && err.code === 'aborted') return
          patch({ status: 'error', error: err, items: [], nextPageToken: null })
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [normalized, attempt, patch])

  const retry = () => {
    patch({ submitted: '', attempt: attempt + 1 })
  }

  const loadMore = async () => {
    if (!nextPageToken) return
    setLoadingMore(true)
    try {
      const more = await youtube.search(submitted, { pageToken: nextPageToken })
      const seen = new Set(items.map((i) => i.videoId))
      patch({ items: [...items, ...more.items.filter((i) => !seen.has(i.videoId))], nextPageToken: more.nextPageToken })
    } catch (err) {
      patch({ error: err })
    } finally {
      setLoadingMore(false)
    }
  }

  const showResults = normalized.length >= MIN_CHARS

  return (
    <div>
      <PageHeader title={t.search.title} />
      <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bg" size={22} />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={100}
            value={query}
            onChange={(e) => {
              patch({ query: e.target.value })
            }}
            placeholder={t.search.placeholder}
            aria-label={t.search.placeholder}
            className="w-full rounded-lg bg-text py-3 pl-11 pr-11 font-medium text-bg placeholder:text-bg/60 focus:outline-none focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label={t.search.clear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-bg/70"
              onClick={() => {
                patch({ query: '', submitted: '', items: [], status: 'idle', error: null, nextPageToken: null })
                inputRef.current?.focus()
              }}
            >
              <CloseIcon size={20} />
            </button>
          )}
        </div>
      </div>

      {youtube.isMock && <p className="mb-4 rounded-lg bg-surface px-3 py-2 text-xs text-muted">{t.search.demoNotice}</p>}

      {!showResults && (
        <div className="space-y-4">
          {recent.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-bold">{t.search.recent}</h2>
                <button
                  type="button"
                  className="text-xs font-semibold text-muted"
                  onClick={() => {
                    writeJson(RECENT_KEY, [])
                    setRecent([])
                  }}
                >
                  {t.search.clearRecent}
                </button>
              </div>
              <ul>
                {recent.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg py-2.5 text-left active:bg-surface"
                      onClick={() => {
                        patch({ query: r })
                      }}
                    >
                      <ClockIcon size={18} className="text-muted" />
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!youtube.isMock && <p className="text-xs text-muted">{t.search.hint}</p>}
        </div>
      )}

      {showResults && status === 'loading' && <Spinner />}
      {showResults && status === 'error' && (
        <ErrorNotice message={errorMessage(error)} onRetry={isQuotaError(error) ? undefined : retry} />
      )}
      {showResults && status === 'done' && items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">{t.search.noResults(submitted)}</p>
      )}
      {showResults && status === 'done' && items.length > 0 && (
        <div>
          {items.map((track, i) => (
            <TrackRow
              key={track.videoId}
              track={track}
              onPlay={() => {
                playTracks(items, i, { context: `${t.search.title}: “${submitted}”` })
              }}
            />
          ))}
          {nextPageToken && (
            <button type="button" className="btn-secondary mx-auto mt-4 flex" disabled={loadingMore} onClick={() => void loadMore()}>
              {t.search.loadMore}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
