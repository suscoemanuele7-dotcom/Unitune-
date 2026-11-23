import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuthStore } from '../auth/useAuthStore'
import { BottomSheet, SheetAction } from '../components/BottomSheet'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { Cover } from '../components/Cover'
import { EmptyState, ErrorNotice, Spinner } from '../components/common'
import { PlaylistFormSheet } from '../components/PlaylistFormSheet'
import { TrackRow } from '../components/TrackRow'
import {
  ChevronLeftIcon,
  EditIcon,
  GlobeIcon,
  HeartIcon,
  MoreIcon,
  PlayIcon,
  SchoolIcon,
  ShareIcon,
  ShuffleIcon,
  SparkleIcon,
  TrashIcon,
} from '../components/icons'
import { useLibraryStore } from '../data/useLibraryStore'
import { useDominantColor } from '../hooks/useDominantColor'
import { errorMessage } from '../lib/errors'
import { usePlayerStore } from '../player/usePlayerStore'
import { toast } from '../ui/useToastStore'
import { t } from '../i18n'

export function PlaylistPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const detail = useLibraryStore((s) => s.playlistCache[id])
  const userId = useAuthStore((s) => s.user?.id)
  const playTracks = usePlayerStore((s) => s.playTracks)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const color = useDominantColor(detail?.summary.coverUrls[0])

  const missing = !detail
  useEffect(() => {
    let active = true
    useLibraryStore
      .getState()
      .loadPlaylist(id)
      .then(() => {
        if (active) setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(err)
      })
    return () => {
      active = false
    }
  }, [id, attempt, missing])

  const back = (
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
  )

  if (!detail) {
    return (
      <div className="space-y-4">
        {back}
        {error ? (
          <ErrorNotice
            message={errorMessage(error)}
            onRetry={() => {
              setAttempt(attempt + 1)
            }}
          />
        ) : (
          <Spinner />
        )}
      </div>
    )
  }

  const { summary, entries, isSaved } = detail
  const isOwner = summary.ownerId === userId
  const tracks = entries.map((e) => e.track)
  const context = summary.name

  const share = async () => {
    if (!summary.isPublic) {
      toast(t.playlist.privateShareHint)
      return
    }
    const url = `${window.location.origin}/playlist/${summary.id}`
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: summary.name, text: t.playlist.shareText(summary.name), url })
      } else {
        await navigator.clipboard.writeText(url)
        toast(t.playlist.linkCopied)
      }
    } catch (err) {
      // L'utente ha chiuso il pannello di condivisione: nessun errore da mostrare.
      if (err instanceof DOMException && err.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        toast(t.playlist.linkCopied)
      } catch {
        toast(url)
      }
    }
  }

  const toggleSaved = () => {
    useLibraryStore
      .getState()
      .setSaved(summary.id, !isSaved)
      .then(() => {
        toast(isSaved ? t.playlist.unsavedToast : t.playlist.savedToast)
      })
      .catch((err: unknown) => {
        toast(errorMessage(err), 'error')
      })
  }

  return (
    <div>
      <div className="-mx-4 -mt-4 px-4 pb-5 pt-4" style={{ background: `linear-gradient(to bottom, ${color}, var(--color-bg))` }}>
        {back}
        <div className="mt-2 flex flex-col items-center gap-4">
          <Cover urls={summary.coverUrls} alt={summary.name} className="aspect-square w-52 shadow-2xl" />
          <div className="w-full space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
            {summary.description && <p className="text-sm text-white/70">{summary.description}</p>}
            <p className="flex items-center gap-1.5 text-xs text-white/70">
              {summary.isUniversity ? <SchoolIcon size={14} /> : summary.isPublic ? <GlobeIcon size={14} /> : null}
              {t.library.by(summary.ownerName)} · {t.library.songs(summary.trackCount)}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-1">
        {!isOwner && summary.isPublic && (
          <button
            type="button"
            className={`icon-btn ${isSaved ? 'text-accent hover:text-accent' : ''}`}
            aria-label={isSaved ? t.playlist.saved : t.playlist.save}
            aria-pressed={isSaved}
            onClick={toggleSaved}
          >
            <HeartIcon filled={isSaved} />
          </button>
        )}
        <button type="button" className="icon-btn" aria-label={t.playlist.share} onClick={() => void share()}>
          <ShareIcon />
        </button>
        {isOwner && (
          <button
            type="button"
            className="icon-btn"
            aria-label={t.common.more}
            onClick={() => {
              setMenuOpen(true)
            }}
          >
            <MoreIcon />
          </button>
        )}
        <div className="flex-1" />
        {tracks.length > 0 && (
          <>
            <button
              type="button"
              className="icon-btn text-accent-2 hover:text-accent-2"
              aria-label={t.playlist.smartShuffle}
              title={t.playlist.smartShuffle}
              onClick={() => {
                playTracks(tracks, Math.floor(Math.random() * tracks.length), { smart: true, context, playlistId: summary.id })
              }}
            >
              <SparkleIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t.playlist.shuffle}
              onClick={() => {
                playTracks(tracks, Math.floor(Math.random() * tracks.length), { shuffle: true, smart: false, context, playlistId: summary.id })
              }}
            >
              <ShuffleIcon />
            </button>
            <button
              type="button"
              aria-label={t.playlist.play}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95"
              onClick={() => {
                playTracks(tracks, 0, { shuffle: false, context, playlistId: summary.id })
              }}
            >
              <PlayIcon />
            </button>
          </>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState>{t.playlist.empty}</EmptyState>
      ) : (
        entries.map((entry, i) => (
          <TrackRow
            key={entry.entryId}
            track={entry.track}
            onPlay={() => {
              playTracks(tracks, i, { context, playlistId: summary.id })
            }}
            extraActions={
              isOwner
                ? [
                    {
                      label: t.playlist.removeTrack,
                      icon: <TrashIcon />,
                      destructive: true,
                      onSelect: () => {
                        useLibraryStore
                          .getState()
                          .removeFromPlaylist(summary.id, entry.entryId)
                          .then(() => {
                            toast(t.playlist.trackRemoved)
                          })
                          .catch((err: unknown) => {
                            toast(errorMessage(err), 'error')
                          })
                      },
                    },
                  ]
                : undefined
            }
          />
        ))
      )}

      <BottomSheet
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false)
        }}
        title={summary.name}
      >
        <SheetAction
          icon={<EditIcon />}
          label={t.playlist.edit}
          onClick={() => {
            setMenuOpen(false)
            setEditOpen(true)
          }}
        />
        <SheetAction
          icon={<TrashIcon />}
          label={t.playlist.delete}
          destructive
          onClick={() => {
            setMenuOpen(false)
            setConfirmDelete(true)
          }}
        />
      </BottomSheet>
      <PlaylistFormSheet
        open={editOpen}
        initial={{
          name: summary.name,
          description: summary.description,
          isPublic: summary.isPublic,
          isUniversity: summary.isUniversity,
        }}
        onClose={() => {
          setEditOpen(false)
        }}
        onSubmit={async (input) => {
          try {
            await useLibraryStore.getState().updatePlaylist(summary.id, input)
            await useLibraryStore.getState().loadPlaylist(summary.id)
          } catch (err) {
            toast(errorMessage(err), 'error')
          }
        }}
      />
      <ConfirmSheet
        open={confirmDelete}
        message={t.playlist.confirmDelete(summary.name)}
        confirmLabel={t.playlist.delete}
        onClose={() => {
          setConfirmDelete(false)
        }}
        onConfirm={() => {
          useLibraryStore
            .getState()
            .deletePlaylist(summary.id)
            .then(() => {
              toast(t.playlist.deleted)
              void navigate('/library', { replace: true })
            })
            .catch((err: unknown) => {
              toast(errorMessage(err), 'error')
            })
        }}
      />
    </div>
  )
}
