import { memo } from 'react'
import { displayInfo, formatDuration } from '../lib/trackDisplay'
import { usePlayerStore } from '../player/usePlayerStore'
import { useTrackMenu, type ExtraAction } from '../ui/useTrackMenu'
import type { Track } from '../types'
import { Cover } from './Cover'
import { EqualizerIcon, MoreIcon } from './icons'
import { t } from '../i18n'

interface TrackRowProps {
  track: Track
  onPlay: () => void
  /** Testo secondario alternativo (es. "3 ore fa"). */
  meta?: string
  extraActions?: ExtraAction[]
}

export const TrackRow = memo(function TrackRow({ track, onPlay, meta, extraActions }: TrackRowProps) {
  const info = displayInfo(track)
  const isCurrent = usePlayerStore((s) => s.queue.items[s.queue.index]?.track.videoId === track.videoId)
  const isPlaying = usePlayerStore((s) => s.wantsToPlay)
  const openMenu = useTrackMenu((s) => s.open)

  return (
    <div className="group flex items-center gap-3 rounded-lg py-1.5 pl-1 pr-0 transition active:bg-surface">
      <button type="button" onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Cover urls={[track.thumbnailUrl]} className="h-12 w-12" rounded="rounded" />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-medium ${isCurrent ? 'text-accent' : 'text-text'}`}>
            {isCurrent && (
              <span className="mr-1.5 inline-block align-[-2px]">
                <EqualizerIcon playing={isPlaying} size={13} />
              </span>
            )}
            {info.title}
          </p>
          <p className="truncate text-[13px] text-muted">
            {info.artist}
            {meta ? ` · ${meta}` : track.durationSec ? ` · ${formatDuration(track.durationSec)}` : ''}
          </p>
        </div>
      </button>
      <button
        type="button"
        className="icon-btn shrink-0"
        aria-label={`${t.common.more}: ${info.title}`}
        onClick={() => {
          openMenu(track, extraActions)
        }}
      >
        <MoreIcon size={20} />
      </button>
    </div>
  )
})
