import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { audius } from '../api/audius'
import { youtube } from '../api/client'
import { isQuotaError, normalizeQuery, YouTubeApiError } from '../api/youtube'
import { ErrorNotice, PageHeader, Spinner } from '../components/common'
import { TrackRow } from '../components/TrackRow'
import { ClockIcon, CloseIcon, MoonIcon, SearchIcon } from '../components/icons'
import { errorMessage } from '../lib/errors'
import { readJson, writeJson } from '../lib/storage'
import { usePlayerStore } from '../player/usePlayerStore'
import type { Track, TrackSource } from '../types'
import { t } from '../i18n'
import { trackKey } from '../../supabase/functions/_shared/contract.ts'
import { AudiusApiError } from '../api/audius'

const MIN_CHARS = 2
const DEBOUNCE_MS = 450
const RECENT_KEY = 'unitune.search.recent'
const PREVIEW = 5

type Filter = 'all' | TrackSource

interface SourceResult {
  /** Query a cui si riferiscono i risultati. */
  query: string
  status: 'idle' | 'loading' | 'done' | 'error'
  items: Track[]
  error: unknown
  /** pageToken (YouTube) o offset (Audius) della pagina successiva. */
  next: string | number | null
}

const emptyResult: SourceResult = { query: '', status: 'idle', items: [], error: null, next: null }

interface SearchState {
  query: string
  filter: Filter
  results: Record<TrackSource, SourceResult>
  /** Incrementato da "Riprova" per rieseguire la stessa ricerca. */
  attempt: number
  patch: (p: Partial<Omit<SearchState, 'patch' | 'setResult'>>) => void
  setResult: (source: TrackSource, r: Partial<SourceResult>) => void
}

/** Stato della ricerca mantenuto tra un cambio pagina e l'altro. */
const useSearchState = create<SearchState>()((set, get) => ({
  query: '',
  filter: 'all',
  results: { youtube: emptyResult, audius: emptyResult },
  attempt: 0,
  patch: (p) => {
    set(p)
  },
  setResult: (source, r) => {
    set({ results: { ...get().results, [source]: { ...get().results[source], ...r } } })
  },
}))

function loadRecent(): string[] {
  return readJson(RECENT_KEY, (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')) ?? []
}

function isAborted(err: unknown): boolean {
  return (err instanceof YouTubeApiError || err instanceof AudiusApiError) && err.code === 'aborted'
}

/** Esegue la ricerca su una fonte (prima pagina). */
function searchSource(source: TrackSource, q: string, signal: AbortSignal): Promise<{ items: Track[]; next: string | number | null }> {
  if (source === 'youtube') {
    return youtube.search(q, { signal }).then((r) => ({ items: r.items, next: r.nextPageToken }))
  }
  return audius.search(q, { signal }).then((r) => ({ items: r.items, next: r.nextOffset }))
}

export function SearchPage() {
  const { query, filter, results, attempt, patch, setResult } = useSearchState()
  const [recent, setRecent] = useState(loadRecent)
  const [loadingMore, setLoadingMore] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const normalized = normalizeQuery(query)
  const sources: TrackSource[] = filter === 'all' ? ['youtube', 'audius'] : [filter]

  // Ricerca con debounce, solo sulle fonti visibili e solo se servono
  // risultati nuovi (così cambiare filtro non spreca quota YouTube).
  useEffect(() => {
    if (normalized.length < MIN_CHARS) return
    const toRun = sources.filter((s) => useSearchState.getState().results[s].query !== normalized)
    if (toRun.length === 0) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      for (const source of toRun) {
        setResult(source, { query: normalized, status: 'loading', error: null })
        searchSource(source, normalized, controller.signal)
          .then(({ items, next }) => {
            setResult(source, { items, next, status: 'done' })
          })
          .catch((err: unknown) => {
            if (isAborted(err)) return
            setResult(source, { status: 'error', error: err, items: [], next: null })
          })
      }
      const updated = [normalized, ...loadRecent().filter((r) => r !== normalized)].slice(0, 8)
      writeJson(RECENT_KEY, updated)
      setRecent(updated)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
      // Una ricerca interrotta va rifatta alla prossima occasione.
      for (const source of toRun) {
        if (useSearchState.getState().results[source].status === 'loading') setResult(source, { query: '', status: 'idle' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sources` deriva da `filter`
  }, [normalized, filter, attempt, setResult])

  const retry = (source: TrackSource) => {
    setResult(source, { query: '' })
    patch({ attempt: attempt + 1 })
  }

  const loadMore = async (source: TrackSource) => {
    const r = results[source]
    if (r.next === null) return
    setLoadingMore(true)
    try {
      const more =
        source === 'youtube'
          ? await youtube.search(r.query, { pageToken: String(r.next) }).then((x) => ({ items: x.items, next: x.nextPageToken }))
          : await audius.search(r.query, { offset: Number(r.next) }).then((x) => ({ items: x.items, next: x.nextOffset }))
      const seen = new Set(r.items.map(trackKey))
      setResult(source, { items: [...r.items, ...more.items.filter((i) => !seen.has(trackKey(i)))], next: more.next })
    } catch (err) {
      setResult(source, { error: err })
    } finally {
      setLoadingMore(false)
    }
  }

  const showResults = normalized.length >= MIN_CHARS
  const filters: [Filter, string][] = [
    ['all', t.search.filters.all],
    ['youtube', t.search.filters.youtube],
    ['audius', t.search.filters.audius],
  ]

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
                patch({ query: '', results: { youtube: emptyResult, audius: emptyResult } })
                inputRef.current?.focus()
              }}
            >
              <CloseIcon size={20} />
            </button>
          )}
        </div>
        <div role="tablist" aria-label={t.search.filters.label} className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {filters.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => {
                patch({ filter: key })
              }}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                filter === key ? 'bg-accent text-white' : 'bg-surface-2 text-text'
              }`}
            >
              {key === 'audius' && <MoonIcon size={12} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {!showResults && (
        <div className="space-y-4">
          <p className="rounded-lg bg-surface px-3 py-2 text-xs text-muted">{t.search.sourcesHint}</p>
          {youtube.isMock && <p className="rounded-lg bg-surface px-3 py-2 text-xs text-muted">{t.search.demoNotice}</p>}
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

      {showResults && (
        <div className="space-y-8">
          {sources.map((source) => (
            <ResultSection
              key={source}
              source={source}
              result={results[source]}
              preview={filter === 'all'}
              loadingMore={loadingMore}
              onShowAll={() => {
                patch({ filter: source })
              }}
              onRetry={() => {
                retry(source)
              }}
              onLoadMore={() => void loadMore(source)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ResultSection({
  source,
  result,
  preview,
  loadingMore,
  onShowAll,
  onRetry,
  onLoadMore,
}: {
  source: TrackSource
  result: SourceResult
  preview: boolean
  loadingMore: boolean
  onShowAll: () => void
  onRetry: () => void
  onLoadMore: () => void
}) {
  const playTracks = usePlayerStore((s) => s.playTracks)
  const title = source === 'youtube' ? t.search.sections.youtube : t.search.sections.audius
  const items = preview ? result.items.slice(0, PREVIEW) : result.items
  const context = `${t.search.title}: “${result.query}”`

  return (
    <section aria-label={title}>
      <div className="mb-1 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-bold">
            {source === 'audius' && <MoonIcon size={14} className="text-accent" />}
            {title}
          </h2>
          {source === 'audius' && <p className="text-xs text-muted">{t.player.background}</p>}
          {source === 'youtube' && youtube.isMock && <p className="text-xs text-muted">{t.search.demoShort}</p>}
        </div>
        {preview && result.items.length > PREVIEW && (
          <button type="button" onClick={onShowAll} className="shrink-0 text-xs font-semibold text-muted hover:text-text">
            {t.common.seeAll}
          </button>
        )}
      </div>
      {result.status === 'loading' && <Spinner />}
      {result.status === 'error' && (
        <ErrorNotice message={errorMessage(result.error)} onRetry={isQuotaError(result.error) ? undefined : onRetry} />
      )}
      {result.status === 'done' && result.items.length === 0 && (
        <p className="py-4 text-sm text-muted">{t.search.noResults(result.query)}</p>
      )}
      {items.length > 0 && result.status !== 'loading' && (
        <div>
          {items.map((track, i) => (
            <TrackRow
              key={trackKey(track)}
              track={track}
              onPlay={() => {
                playTracks(result.items, i, { context })
              }}
            />
          ))}
          {!preview && result.next !== null && (
            <button type="button" className="btn-secondary mx-auto mt-4 flex" disabled={loadingMore} onClick={onLoadMore}>
              {t.search.loadMore}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
