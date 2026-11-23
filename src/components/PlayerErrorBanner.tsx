import { usePlayerStore, willAutoSkip } from '../player/usePlayerStore'
import { t } from '../i18n'

/** Spiega perché un brano non parte (offline, embed disabilitato, …). */
export function PlayerErrorBanner({ compact = false }: { compact?: boolean }) {
  const error = usePlayerStore((s) => s.error)
  const skipping = usePlayerStore(willAutoSkip)
  const dismiss = usePlayerStore((s) => s.dismissError)
  if (!error) return null

  const message = t.player.errors[error.code]

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg bg-red-500/15 text-red-100 ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'}`}
    >
      <div className="flex-1">
        <p>{message}</p>
        {skipping && <p className="mt-0.5 opacity-80">{t.player.errors.skipping}</p>}
        {error.code === 'embed_disabled' && error.track && (
          <a
            className="mt-1 inline-block font-semibold underline"
            href={error.track.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.player.errors.openOnYouTube}
          </a>
        )}
      </div>
      <button type="button" onClick={dismiss} className="shrink-0 font-semibold opacity-80 hover:opacity-100" aria-label={t.common.close}>
        ✕
      </button>
    </div>
  )
}
