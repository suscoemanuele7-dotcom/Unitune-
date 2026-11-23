import { BottomSheet } from './BottomSheet'
import { t } from '../i18n'

export function ConfirmSheet({
  open,
  message,
  confirmLabel = t.common.confirm,
  onConfirm,
  onClose,
}: {
  open: boolean
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="space-y-5 px-2 pt-2">
        <p className="text-center">{message}</p>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn-primary flex-1 bg-red-500"
            onClick={() => {
              onClose()
              onConfirm()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
