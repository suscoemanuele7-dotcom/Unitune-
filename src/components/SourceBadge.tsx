import type { Track } from '../types'
import { MoonIcon, SparkleIcon } from './icons'
import { t } from '../i18n'

/**
 * Etichetta della fonte. Solo i brani Audius la mostrano: sono quelli che
 * continuano a suonare a schermo spento (icona luna).
 */
export function SourceBadge({ track }: { track: Track }) {
  if (track.source !== 'audius') return null
  return (
    <span
      title={t.player.background}
      className="mr-1.5 inline-flex shrink-0 items-center gap-0.5 rounded bg-accent/20 px-1 py-px align-[1px] text-[10px] font-semibold text-accent"
    >
      <MoonIcon size={9} />
      Audius
    </span>
  )
}

export function RecommendedBadge() {
  return (
    <span title={t.player.recommended} className="mr-1 inline-flex align-[-1px] text-accent-2">
      <SparkleIcon size={13} />
      <span className="sr-only">{t.player.recommended}</span>
    </span>
  )
}
