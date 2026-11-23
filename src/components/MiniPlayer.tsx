import { useNavigate } from 'react-router'
import { useLibraryStore, useIsFavorite } from '../data/useLibraryStore'
import { useDominantColor } from '../hooks/useDominantColor'
import { displayInfo } from '../lib/trackDisplay'
import { useCurrentTrack, usePlayerStore } from '../player/usePlayerStore'
import { toast } from '../ui/useToastStore'
import { errorMessage } from '../lib/errors'
import { Cover } from './Cover'
import { PlayPauseButton } from './PlayerControls'
import { PlayerErrorBanner } from './PlayerErrorBanner'
import { HeartIcon } from './icons'
import { SourceBadge } from './SourceBadge'
import { t } from '../i18n'

/** Barra persistente sopra la navigazione; tocco → player a schermo intero. */
export function MiniPlayer() {
  const track = useCurrentTrack()
  const navigate = useNavigate()
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const status = usePlayerStore((s) => s.status)
  const isFavorite = useIsFavorite(track)
  const color = useDominantColor(track?.thumbnailUrl)

  if (!track) return null
  const info = displayInfo(track)
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div className="px-2 pb-1.5">
      <div className="mb-1.5">
        <PlayerErrorBanner compact />
      </div>
      <div
        data-playback-status={status}
        className="relative overflow-hidden rounded-lg shadow-lg"
        style={{ background: `linear-gradient(90deg, ${color}, color-mix(in oklab, ${color} 70%, black))` }}
      >
        <div className="flex items-center gap-2 py-1.5 pl-1.5 pr-1">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            onClick={() => {
              void navigate('/player')
            }}
            aria-label={`${t.player.nowPlaying}: ${info.title}, ${info.artist}`}
          >
            <Cover urls={[track.thumbnailUrl]} className="h-10 w-10" rounded="rounded" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{info.title}</span>
              <span className="block truncate text-xs text-white/70">
                <SourceBadge track={track} />
                {info.artist}
              </span>
            </span>
          </button>
          <button
            type="button"
            className={`icon-btn ${isFavorite ? 'text-accent hover:text-accent' : 'text-white/80'}`}
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
            <HeartIcon filled={isFavorite} size={22} />
          </button>
          <PlayPauseButton size="sm" />
        </div>
        <div className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-white/20" aria-hidden>
          <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}
