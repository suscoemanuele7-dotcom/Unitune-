import { useToastStore } from '../ui/useToastStore'

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
      {toasts.map((toast) => (
        <button
          type="button"
          key={toast.id}
          onClick={() => {
            dismiss(toast.id)
          }}
          className={`pointer-events-auto max-w-md animate-slide-up rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
            toast.kind === 'error' ? 'bg-red-500 text-white' : 'bg-text text-bg'
          }`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}
