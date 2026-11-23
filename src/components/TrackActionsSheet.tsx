import { useState } from 'react'
import { useLibraryStore } from '../data/useLibraryStore'
import { displayInfo } from '../lib/trackDisplay'
import { usePlayerStore } from '../player/usePlayerStore'
import { toast } from '../ui/useToastStore'
import { useTrackMenu } from '../ui/useTrackMenu'
import { errorMessage } from '../lib/errors'
import { BottomSheet, SheetAction } from './BottomSheet'
import { Cover } from './Cover'
import { PlaylistFormSheet } from './PlaylistFormSheet'
import { ExternalIcon, HeartIcon, PlusIcon, QueueIcon, NextIcon } from './icons'
import { t } from '../i18n'

/** Menu "⋯" di un brano, condiviso da tutte le pagine. */
export function TrackActionsSheet() {
  const track = useTrackMenu((s) => s.track)
  const extra = useTrackMenu((s) => s.extra)
  const close = useTrackMenu((s) => s.close)
  const [step, setStep] = useState<'actions' | 'playlists'>('actions')
  const [formOpen, setFormOpen] = useState(false)

  const isFavorite = useLibraryStore((s) => (track ? s.favorites.some((f) => f.track.videoId === track.videoId) : false))
  const myPlaylists = useLibraryStore((s) => s.myPlaylists)

  const done = () => {
    setStep('actions')
    close()
  }

  if (!track) {
    return null
  }
  const info = displayInfo(track)

  const run = (fn: () => Promise<unknown>, success?: string) => {
    done()
    fn()
      .then(() => {
        if (success) toast(success)
      })
      .catch((error: unknown) => {
        toast(errorMessage(error), 'error')
      })
  }

  return (
    <>
      <BottomSheet open={!formOpen} onClose={done} title={step === 'playlists' ? t.track.choosePlaylist : undefined}>
        {step === 'actions' ? (
          <>
            <div className="mb-2 flex items-center gap-3 border-b border-border px-3 pb-3">
              <Cover urls={[track.thumbnailUrl]} className="h-12 w-12" rounded="rounded" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{info.title}</p>
                <p className="truncate text-sm text-muted">{info.artist}</p>
              </div>
            </div>
            <SheetAction
              icon={<HeartIcon filled={isFavorite} className={isFavorite ? 'text-accent' : ''} />}
              label={isFavorite ? t.track.removeFavorite : t.track.addFavorite}
              onClick={() => {
                run(
                  () => useLibraryStore.getState().toggleFavorite(track),
                  isFavorite ? t.favorites.removed : t.favorites.added,
                )
              }}
            />
            <SheetAction
              icon={<PlusIcon />}
              label={t.track.addToPlaylist}
              onClick={() => {
                setStep('playlists')
              }}
            />
            <SheetAction
              icon={<NextIcon size={22} />}
              label={t.track.playNext}
              onClick={() => {
                usePlayerStore.getState().playNext(track)
                done()
                toast(t.track.queuedNext)
              }}
            />
            <SheetAction
              icon={<QueueIcon />}
              label={t.track.addToQueue}
              onClick={() => {
                usePlayerStore.getState().addToQueue(track)
                done()
                toast(t.track.queued)
              }}
            />
            {extra.map((action) => (
              <SheetAction
                key={action.label}
                icon={action.icon}
                label={action.label}
                destructive={action.destructive}
                onClick={() => {
                  done()
                  action.onSelect()
                }}
              />
            ))}
            <a
              href={`https://www.youtube.com/watch?v=${track.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={done}
              className="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-[15px] hover:bg-surface"
            >
              <span className="text-muted">
                <ExternalIcon />
              </span>
              {t.track.openOnYouTube}
            </a>
          </>
        ) : (
          <>
            <SheetAction
              icon={<PlusIcon />}
              label={t.library.newPlaylist}
              onClick={() => {
                setFormOpen(true)
              }}
            />
            {myPlaylists.length === 0 && <p className="px-3 py-4 text-sm text-muted">{t.track.noPlaylists}</p>}
            {myPlaylists.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  run(() => useLibraryStore.getState().addToPlaylist(p.id, track), t.playlist.addedTo(p.name))
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface"
              >
                <Cover urls={p.coverUrls} className="h-11 w-11" rounded="rounded" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-xs text-muted">{t.library.songs(p.trackCount)}</span>
                </span>
              </button>
            ))}
          </>
        )}
      </BottomSheet>
      <PlaylistFormSheet
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          done()
        }}
        onSubmit={async (input) => {
          try {
            const created = await useLibraryStore.getState().createPlaylist(input)
            await useLibraryStore.getState().addToPlaylist(created.id, track)
            toast(t.playlist.addedTo(created.name))
          } catch (error) {
            toast(errorMessage(error), 'error')
          }
        }}
      />
    </>
  )
}
