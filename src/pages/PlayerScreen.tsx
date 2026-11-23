import { createPortal } from 'react-dom'
import { useCallback } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { PlayerErrorBanner } from '../components/PlayerErrorBanner'
import { SeekBar, TransportControls, VolumeControl } from '../components/PlayerControls'
import { ChevronDownIcon, ExternalIcon, HeartIcon, MoonIcon, MoreIcon, PlusIcon, QueueIcon, SparkleIcon } from '../components/icons'
import { Cover } from '../components/Cover'
import { SourceBadge } from '../components/SourceBadge'
import { useIsFavorite, useLibraryStore } from '../data/useLibraryStore'
import { useDominantColor } from '../hooks/useDominantColor'
import { errorMessage } from '../lib/errors'
import { displayInfo } from '../lib/trackDisplay'
import { usePlayerLayout } from '../player/usePlayerLayout'
import { useCurrentTrack, usePlayerStore } from '../player/usePlayerStore'
import { toast } from '../ui/useToastStore'
import { useTrackMenu } from '../ui/useTrackMenu'
import { t } from '../i18n'

/**
 * Player a schermo intero.
 * - Brano YouTube: il riquadro quadrato al centro è lo "slot" su cui
 *   PlayerHost posiziona l'iframe: il video fa da copertina ed è sempre
 *   visibile (≥ 200×200 px) mentre suona.
 * - Brano Audius: copertina vera; l'audio continua anche a schermo spento.
 */
export function PlayerScreen() {
  const track = useCurrentTrack()
  const navigate = useNavigate()
  const contextLabel = usePlayerStore((s) => s.contextLabel)
  const needsGesture = usePlayerStore((s) => s.needsUserGesture)
  const isFavorite = useIsFavorite(track)
  const recommended = usePlayerStore((s) => s.queue.items[s.queue.index]?.recommended === true)
  const contextPlaylistId = usePlayerStore((s) => s.contextPlaylistId)
  const contextPlaylist = useLibraryStore((s) =>
    contextPlaylistId ? s.myPlaylists.find((p) => p.id === contextPlaylistId) : undefined,
  )
  const color = useDominantColor(track?.thumbnailUrl)
  const setSlot = usePlayerLayout((s) => s.setFullscreenSlot)
  const openMenu = useTrackMenu((s) => s.open)

  // Callback ref: registra/rimuove lo slot quando il riquadro monta/smonta.
  const slotRef = useCallback(
    (el: HTMLDivElement | null) => {
      setSlot(el)
    },
    [setSlot],
  )

  if (!track) return <Navigate to="/" replace />
  const info = displayInfo(track)

  const close = () => {
    if (window.history.length > 1) void navigate(-1)
    else void navigate('/', { replace: true })
  }

  // Portal: la pagina copre l'app, il cui contenuto diventa `inert`.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.player.nowPlaying}
      className="pt-safe pb-safe fixed inset-0 z-30 overflow-y-auto"
      style={{ background: `linear-gradient(to bottom, ${color} 0%, color-mix(in oklab, ${color} 35%, var(--color-bg)) 55%, var(--color-bg) 100%)` }}
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col px-6 pb-6">
        <header className="flex items-center justify-between py-3">
          <button type="button" className="icon-btn -ml-2 text-text" aria-label={t.player.close} onClick={close}>
            <ChevronDownIcon size={28} />
          </button>
          <div className="min-w-0 px-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">{t.player.nowPlaying}</p>
            {contextLabel && <p className="truncate text-xs font-semibold">{contextLabel}</p>}
          </div>
          <button
            type="button"
            className="icon-btn -mr-2 text-text"
            aria-label={t.common.more}
            onClick={() => {
              openMenu(track)
            }}
          >
            <MoreIcon />
          </button>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-3 py-4">
          {track.source === 'youtube' ? (
            <div
              ref={slotRef}
              className="mx-auto aspect-square w-full min-w-[200px] max-w-[min(100%,46dvh)] overflow-hidden rounded-lg bg-black shadow-2xl"
            />
          ) : (
            <Cover
              urls={[track.thumbnailUrl]}
              alt=""
              className="mx-auto aspect-square w-full max-w-[min(100%,46dvh)] shadow-2xl"
              rounded="rounded-lg"
            />
          )}
          {needsGesture && (
            <p className="text-center text-xs text-white/80">
              {track.source === 'youtube' ? t.player.tapToStart : t.player.tapToPlay}
            </p>
          )}
        </div>

        <div className="space-y-5">
          <PlayerErrorBanner />
          {recommended && (
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs">
              <SparkleIcon size={14} className="shrink-0 text-accent-2" />
              <span className="flex-1">{t.player.recommended}</span>
              {contextPlaylist && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-text px-3 py-1 font-semibold text-bg"
                  onClick={() => {
                    useLibraryStore
                      .getState()
                      .addToPlaylist(contextPlaylist.id, track)
                      .then(() => {
                        toast(t.playlist.addedTo(contextPlaylist.name))
                      })
                      .catch((error: unknown) => {
                        toast(errorMessage(error), 'error')
                      })
                  }}
                >
                  <PlusIcon size={14} />
                  {t.player.addRecommendedTo(contextPlaylist.name)}
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold">{info.title}</h1>
              <p className="truncate text-white/70">
                <SourceBadge track={track} />
                {info.artist}
              </p>
            </div>
            <button
              type="button"
              className={`icon-btn -mr-2 ${isFavorite ? 'text-accent hover:text-accent' : 'text-text'}`}
              aria-label={isFavorite ? t.track.removeFavorite : t.track.addFavorite}
              aria-pressed={isFavorite}
              onClick={() => {
                useLibraryStore
                  .getState()
                  .toggleFavorite(track)
                  .catch((error: unknown) => {
                    toast(errorMessage(error), 'error')
                  })
              }}
            >
              <HeartIcon filled={isFavorite} size={26} />
            </button>
          </div>
          <SeekBar />
          <TransportControls />
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <VolumeControl />
            </div>
            <Link to="/queue" className="icon-btn -mr-2" aria-label={t.player.queue}>
              <QueueIcon />
            </Link>
          </div>
          {track.source === 'youtube' ? (
            <div className="space-y-1 text-center text-[11px] text-white/50">
              <p className="flex items-center justify-center gap-1.5">
                {t.player.officialPlayerNote}
                <a href={track.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">
                  YouTube <ExternalIcon size={11} />
                </a>
              </p>
              <p>{t.player.youtubeBackgroundNote}</p>
            </div>
          ) : (
            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-white/60">
              <MoonIcon size={11} /> {t.player.background} ·
              <a href={track.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">
                {t.player.audiusAttribution} <ExternalIcon size={11} />
              </a>
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
