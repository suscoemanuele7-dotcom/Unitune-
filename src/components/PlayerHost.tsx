/**
 * Contenitore dell'unico iframe di YouTube.
 *
 * L'iframe non viene mai spostato nel DOM (sposterebbe = ricaricherebbe il
 * video): cambia solo la posizione CSS del contenitore fisso.
 *
 * Modalità:
 * - "fullscreen": sovrapposto al riquadro "copertina" della PlayerScreen;
 * - "floating":   riquadro 200×200 px sopra il mini-player (minimo
 *                 consentito dalle policy YouTube), spostabile a sinistra o
 *                 a destra; si sposta in alto quando si apre un pannello,
 *                 così non viene mai coperto;
 * - "parked":     fuori schermo, ma SOLO quando non sta riproducendo
 *                 (nessun brano caricato, o player ridotto = in pausa).
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { usePlayerEngine } from '../player/usePlayerEngine'
import { useMediaSession } from '../player/useMediaSession'
import { usePlayerLayout } from '../player/usePlayerLayout'
import { usePlayerStore } from '../player/usePlayerStore'
import { GripIcon, MinimizeIcon } from './icons'
import { t } from '../i18n'

const FLOAT_SIZE = 200
const MARGIN = 12

function useElementRect(el: HTMLElement | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useLayoutEffect(() => {
    if (!el) return
    const update = () => {
      setRect(el.getBoundingClientRect())
    }
    // ResizeObserver invoca subito la callback alla prima osservazione.
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [el])
  return el ? rect : null
}

export function PlayerHost() {
  const containerRef = useRef<HTMLDivElement>(null)
  usePlayerEngine(containerRef)
  useMediaSession()

  const slot = usePlayerLayout((s) => s.fullscreenSlot)
  const overlays = usePlayerLayout((s) => s.overlays)
  const side = usePlayerLayout((s) => s.side)
  const setSide = usePlayerLayout((s) => s.setSide)
  const hasLoadedTrack = usePlayerStore((s) => s.loadedUid !== null && s.queue.index >= 0)
  const collapsed = usePlayerStore((s) => s.floatingCollapsed)
  const needsGesture = usePlayerStore((s) => s.needsUserGesture)
  const setCollapsed = usePlayerStore((s) => s.setFloatingCollapsed)
  const slotRect = useElementRect(slot)
  const [dragX, setDragX] = useState<number | null>(null)
  const dragStart = useRef(0)

  const mode = slot && slotRect ? 'fullscreen' : hasLoadedTrack && !collapsed ? 'floating' : 'parked'

  let style: CSSProperties
  if (mode === 'fullscreen' && slotRect) {
    style = { top: slotRect.top, left: slotRect.left, width: slotRect.width }
  } else if (mode === 'floating') {
    const vertical =
      overlays > 0
        ? { top: `calc(env(safe-area-inset-top) + ${MARGIN}px)` }
        : { bottom: `calc(var(--chrome-bottom, 140px) + ${MARGIN}px)` }
    style = {
      ...vertical,
      width: FLOAT_SIZE,
      ...(side === 'right' ? { right: MARGIN } : { left: MARGIN }),
      ...(dragX !== null ? { transform: `translateX(${dragX}px)`, transition: 'none' } : {}),
    }
  } else {
    style = { top: 0, left: -10_000, width: FLOAT_SIZE, visibility: 'hidden' }
  }
  const playerHeight = mode === 'fullscreen' && slotRect ? slotRect.height : FLOAT_SIZE

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = e.clientX
    setDragX(0)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragX !== null) setDragX(e.clientX - dragStart.current)
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragX === null) return
    setSide(e.clientX < window.innerWidth / 2 ? 'left' : 'right')
    setDragX(null)
  }

  return (
    <div
      className={`fixed z-[45] flex flex-col ${mode === 'floating' ? 'overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10 transition-[top,bottom,left,right] duration-200' : ''}`}
      style={style}
      aria-hidden={mode === 'parked'}
    >
      {mode === 'floating' && (
        <>
          <div
            className="flex h-7 cursor-grab touch-none items-center gap-1 bg-surface-2 pl-2 text-muted active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              setDragX(null)
            }}
            title={t.player.moveSide}
          >
            <GripIcon size={16} />
            <span className="flex-1 truncate text-[10px] font-medium">
              {needsGesture ? t.player.tapToStart : 'YouTube'}
            </span>
            <button
              type="button"
              aria-label={t.player.collapse}
              title={t.player.collapse}
              className="flex h-7 w-8 items-center justify-center hover:text-text"
              onPointerDown={(e) => {
                e.stopPropagation()
              }}
              onClick={() => {
                setCollapsed(true)
              }}
            >
              <MinimizeIcon size={16} />
            </button>
          </div>
        </>
      )}
      {/* L'iframe vive qui dentro. Dimensione minima 200×200 quando visibile. */}
      <div ref={containerRef} className="bg-black [&>iframe]:h-full [&>iframe]:w-full" style={{ height: playerHeight }} />
    </div>
  )
}
