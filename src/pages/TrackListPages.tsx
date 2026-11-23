import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { EmptyState } from '../components/common'
import { TrackRow } from '../components/TrackRow'
import { ChevronLeftIcon, HeartIcon, PlayIcon, ShuffleIcon, TrashIcon } from '../components/icons'
import { useLibraryStore } from '../data/useLibraryStore'
import { errorMessage } from '../lib/errors'
import { relativeTime } from '../lib/time'
import { usePlayerStore } from '../player/usePlayerStore'
import { toast } from '../ui/useToastStore'
import type { Track } from '../types'
import { t } from '../i18n'

function BackHeader({ title, gradient, actions }: { title: string; gradient: string; actions?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className={`-mx-4 -mt-4 mb-4 bg-gradient-to-b ${gradient} to-bg px-4 pb-6 pt-4`}>
      <button
        type="button"
        className="icon-btn -ml-2 text-text"
        aria-label={t.common.back}
        onClick={() => {
          void navigate(-1)
        }}
      >
        <ChevronLeftIcon size={28} />
      </button>
      <div className="mt-10 flex items-end justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {actions}
      </div>
    </div>
  )
}

function PlayButtons({ tracks, context }: { tracks: Track[]; context: string }) {
  const playTracks = usePlayerStore((s) => s.playTracks)
  if (tracks.length === 0) return null
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="icon-btn"
        aria-label={t.playlist.shuffle}
        onClick={() => {
          playTracks(tracks, Math.floor(Math.random() * tracks.length), { shuffle: true, context })
        }}
      >
        <ShuffleIcon />
      </button>
      <button
        type="button"
        aria-label={t.playlist.play}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95"
        onClick={() => {
          playTracks(tracks, 0, { shuffle: false, context })
        }}
      >
        <PlayIcon />
      </button>
    </div>
  )
}

export function FavoritesPage() {
  const favorites = useLibraryStore((s) => s.favorites)
  const playTracks = usePlayerStore((s) => s.playTracks)
  const tracks = favorites.map((f) => f.track)
  return (
    <div>
      <BackHeader
        title={t.favorites.title}
        gradient="from-accent/60"
        actions={<PlayButtons tracks={tracks} context={t.favorites.title} />}
      />
      <p className="mb-3 text-sm text-muted">{t.library.songs(tracks.length)}</p>
      {tracks.length === 0 ? (
        <EmptyState icon={<HeartIcon size={28} />}>{t.favorites.empty}</EmptyState>
      ) : (
        tracks.map((track, i) => (
          <TrackRow
            key={track.videoId}
            track={track}
            onPlay={() => {
              playTracks(tracks, i, { context: t.favorites.title })
            }}
          />
        ))
      )}
    </div>
  )
}

export function HistoryPage() {
  const history = useLibraryStore((s) => s.history)
  const playTracks = usePlayerStore((s) => s.playTracks)
  const [confirm, setConfirm] = useState(false)
  const tracks = history.map((h) => h.track)

  return (
    <div>
      <BackHeader
        title={t.history.title}
        gradient="from-surface-2"
        actions={
          history.length > 0 && (
            <button
              type="button"
              className="icon-btn"
              aria-label={t.history.clear}
              onClick={() => {
                setConfirm(true)
              }}
            >
              <TrashIcon />
            </button>
          )
        }
      />
      {history.length === 0 ? (
        <EmptyState>{t.history.empty}</EmptyState>
      ) : (
        history.map((entry, i) => (
          <TrackRow
            key={entry.id}
            track={entry.track}
            meta={relativeTime(entry.playedAt)}
            onPlay={() => {
              playTracks(tracks, i, { context: t.history.title })
            }}
          />
        ))
      )}
      <ConfirmSheet
        open={confirm}
        message={t.history.confirmClear}
        confirmLabel={t.history.clear}
        onClose={() => {
          setConfirm(false)
        }}
        onConfirm={() => {
          useLibraryStore
            .getState()
            .clearHistory()
            .then(() => {
              toast(t.history.cleared)
            })
            .catch((error: unknown) => {
              toast(errorMessage(error), 'error')
            })
        }}
      />
    </div>
  )
}
