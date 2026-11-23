import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { Cover } from '../components/Cover'
import { EmptyState } from '../components/common'
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, CloseIcon, EqualizerIcon, SparkleIcon } from '../components/icons'
import { RecommendedBadge, SourceBadge } from '../components/SourceBadge'
import { displayInfo } from '../lib/trackDisplay'
import { usePlayerStore } from '../player/usePlayerStore'
import type { QueueItem } from '../player/queue'
import { t } from '../i18n'

export function QueuePage() {
  const navigate = useNavigate()
  const queue = usePlayerStore((s) => s.queue)
  const wantsToPlay = usePlayerStore((s) => s.wantsToPlay)
  const smartLoading = usePlayerStore((s) => s.smartLoading)
  const store = usePlayerStore.getState
  const current = queue.items[queue.index]
  const upNext = queue.items.slice(queue.index + 1)

  // Portal: la pagina copre l'app, il cui contenuto diventa `inert`.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t.queue.title} className="pt-safe pb-safe fixed inset-0 z-30 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-xl px-4 pb-8">
        <header className="flex items-center gap-2 py-3">
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
          <h1 className="flex-1 text-lg font-bold">{t.queue.title}</h1>
          {queue.items.length > 0 && (
            <button
              type="button"
              className="text-sm font-semibold text-muted hover:text-text"
              onClick={() => {
                store().clearQueue()
                void navigate('/', { replace: true })
              }}
            >
              {t.queue.clear}
            </button>
          )}
        </header>

        {!current ? (
          <EmptyState>{t.queue.empty}</EmptyState>
        ) : (
          <>
            {queue.smart && (
              <p role="status" className="mb-3 flex items-center gap-2 rounded-lg bg-accent-2/15 px-3 py-2 text-xs">
                <SparkleIcon size={14} className="text-accent-2" />
                {smartLoading ? t.player.smartLoading : t.queue.smartActive}
              </p>
            )}
            <h2 className="mb-2 mt-2 font-bold">{t.queue.nowPlaying}</h2>
            <Row item={current} active playing={wantsToPlay} />
            {upNext.length > 0 && <h2 className="mb-2 mt-6 font-bold">{t.queue.upNext}</h2>}
            <ol>
              {upNext.map((item, i) => {
                const index = queue.index + 1 + i
                return (
                  <li key={item.uid}>
                    <Row
                      item={item}
                      onPlay={() => {
                        store().jumpTo(index)
                      }}
                      onUp={index > queue.index + 1 ? () => { store().moveInQueue(index, index - 1) } : undefined}
                      onDown={index < queue.items.length - 1 ? () => { store().moveInQueue(index, index + 1) } : undefined}
                      onRemove={() => {
                        store().removeFromQueue(item.uid)
                      }}
                    />
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Row({
  item,
  active = false,
  playing = false,
  onPlay,
  onUp,
  onDown,
  onRemove,
}: {
  item: QueueItem
  active?: boolean
  playing?: boolean
  onPlay?: () => void
  onUp?: (() => void) | undefined
  onDown?: (() => void) | undefined
  onRemove?: () => void
}) {
  const info = displayInfo(item.track)
  return (
    <div className="flex items-center gap-2 py-1.5">
      <button type="button" disabled={!onPlay} onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Cover urls={[item.track.thumbnailUrl]} className="h-11 w-11" rounded="rounded" />
        <span className="min-w-0">
          <span className={`flex items-center gap-1.5 truncate text-[15px] font-medium ${active ? 'text-accent' : ''}`}>
            {active && <EqualizerIcon playing={playing} size={13} />}
            {item.recommended && <RecommendedBadge />}
            <span className="truncate">{info.title}</span>
          </span>
          <span className="block truncate text-[13px] text-muted">
            <SourceBadge track={item.track} />
            {info.artist}
          </span>
        </span>
      </button>
      {onUp !== undefined || onDown !== undefined || onRemove ? (
        <div className="flex shrink-0">
          <button type="button" className="icon-btn" disabled={!onUp} onClick={onUp} aria-label={`${t.queue.moveUp}: ${info.title}`}>
            <ArrowUpIcon size={18} />
          </button>
          <button type="button" className="icon-btn" disabled={!onDown} onClick={onDown} aria-label={`${t.queue.moveDown}: ${info.title}`}>
            <ArrowDownIcon size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={onRemove} aria-label={`${t.queue.remove}: ${info.title}`}>
            <CloseIcon size={18} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
