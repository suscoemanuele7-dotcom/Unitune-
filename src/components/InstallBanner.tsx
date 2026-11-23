import { useCanInstall, useInstallPrompt } from '../pwa/useInstallPrompt'
import { CloseIcon, DownloadIcon } from './icons'
import { t } from '../i18n'

export function InstallBanner() {
  const mode = useCanInstall()
  const dismissed = useInstallPrompt((s) => s.dismissed)
  const dismiss = useInstallPrompt((s) => s.dismiss)
  const promptInstall = useInstallPrompt((s) => s.promptInstall)
  if (!mode || dismissed) return null

  return (
    <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-accent/25 to-accent-2/20 p-4">
      <DownloadIcon className="mt-0.5 shrink-0 text-accent" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">{t.pwa.install}</p>
        <p className="text-muted">{mode === 'ios' ? t.pwa.installIos : t.pwa.installBody}</p>
        {mode === 'prompt' && (
          <button type="button" className="mt-2 rounded-full bg-text px-4 py-1.5 text-xs font-bold text-bg" onClick={() => void promptInstall()}>
            {t.pwa.install}
          </button>
        )}
      </div>
      <button type="button" className="icon-btn -m-1" onClick={dismiss} aria-label={t.common.close}>
        <CloseIcon size={18} />
      </button>
    </div>
  )
}
