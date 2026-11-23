import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePlayerLayout } from '../player/usePlayerLayout'
import { t } from '../i18n'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/**
 * Pannello modale che sale dal basso. Mentre è aperto il player flottante
 * si sposta in alto, così non viene mai coperto (requisito YouTube).
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const layout = usePlayerLayout.getState()
    layout.pushOverlay()
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      usePlayerLayout.getState().popOverlay()
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label={t.common.close}
        className="absolute inset-0 animate-fade-in bg-black/60"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="pb-safe relative max-h-[62dvh] w-full max-w-xl animate-sheet-in overflow-y-auto rounded-t-2xl bg-surface-2 outline-none"
      >
        <div className="sticky top-0 z-10 bg-surface-2 px-4 pb-2 pt-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" aria-hidden />
          {title && (
            <h2 id={titleId} className="truncate text-center text-base font-semibold">
              {title}
            </h2>
          )}
        </div>
        <div className="px-2 pb-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

interface SheetActionProps {
  icon: ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

export function SheetAction({ icon, label, onClick, destructive, disabled }: SheetActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-4 rounded-lg px-3 py-3 text-left text-[15px] transition hover:bg-surface active:bg-surface disabled:opacity-40 ${
        destructive ? 'text-red-400' : 'text-text'
      }`}
    >
      <span className="text-muted">{icon}</span>
      {label}
    </button>
  )
}
