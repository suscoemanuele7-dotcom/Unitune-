import { Link } from 'react-router'
import { useMemo } from 'react'
import { Cover } from '../components/Cover'
import { EmptyState, SectionHeader } from '../components/common'
import { InstallBanner } from '../components/InstallBanner'
import { PlaylistCard } from '../components/PlaylistCard'
import { TrackRow } from '../components/TrackRow'
import { PlayIcon, SearchIcon, SchoolIcon } from '../components/icons'
import { useLibraryStore } from '../data/useLibraryStore'
import { useRecommendations } from '../hooks/useRecommendations'
import { displayInfo } from '../lib/trackDisplay'
import { greeting } from '../lib/time'
import { usePlayerStore } from '../player/usePlayerStore'
import type { Track } from '../types'
import { t } from '../i18n'

export function HomePage() {
  const history = useLibraryStore((s) => s.history)
  const university = useLibraryStore((s) => s.universityPlaylists)
  const recommendations = useRecommendations()
  const playTracks = usePlayerStore((s) => s.playTracks)

  const recent = useMemo(() => {
    const seen = new Set<string>()
    const out: Track[] = []
    for (const h of history) {
      if (seen.has(h.track.videoId)) continue
      seen.add(h.track.videoId)
      out.push(h.track)
      if (out.length === 10) break
    }
    return out
  }, [history])

  return (
    <div className="space-y-9">
      <h1 className="text-2xl font-bold tracking-tight">{greeting()}</h1>
      <InstallBanner />

      <section>
        <SectionHeader title={t.home.recent} to={recent.length > 0 ? '/library/history' : undefined} />
        {recent.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={28} />}
            action={
              <Link to="/search" className="btn-secondary py-2 text-sm">
                {t.home.startSearching}
              </Link>
            }
          >
            {t.home.recentEmpty}
          </EmptyState>
        ) : (
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
            {recent.map((track, i) => (
              <RecentCard
                key={track.videoId}
                track={track}
                onPlay={() => {
                  playTracks(recent, i, { context: t.home.recent })
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title={t.home.university} />
        {university.length === 0 ? (
          <EmptyState icon={<SchoolIcon size={28} />}>{t.home.universityEmpty}</EmptyState>
        ) : (
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
            {university.map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">{t.home.forYou}</h2>
          {recommendations.length > 0 && (
            <button
              type="button"
              aria-label={`${t.playlist.play}: ${t.home.forYou}`}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95"
              onClick={() => {
                playTracks(recommendations, 0, { context: t.home.forYou })
              }}
            >
              <PlayIcon size={20} />
            </button>
          )}
        </div>
        {recommendations.length === 0 ? (
          <EmptyState>{t.home.forYouEmpty}</EmptyState>
        ) : (
          <div>
            {recommendations.slice(0, 8).map((track, i) => (
              <TrackRow
                key={track.videoId}
                track={track}
                onPlay={() => {
                  playTracks(recommendations, i, { context: t.home.forYou })
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function RecentCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  const info = displayInfo(track)
  return (
    <button type="button" onClick={onPlay} className="w-32 shrink-0 space-y-2 text-left active:opacity-80">
      <Cover urls={[track.thumbnailUrl]} alt="" className="aspect-square w-32 shadow-lg" />
      <span className="block">
        <span className="block truncate text-sm font-semibold">{info.title}</span>
        <span className="block truncate text-xs text-muted">{info.artist}</span>
      </span>
    </button>
  )
}
