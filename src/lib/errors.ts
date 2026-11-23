import { YouTubeApiError } from '../api/youtube'
import { DataError } from '../data/repository'
import { inTime } from './time'
import { t } from '../i18n'

/** Messaggio leggibile per qualsiasi errore dell'app. */
export function errorMessage(error: unknown): string {
  if (error instanceof YouTubeApiError) {
    const m = t.youtubeErrors
    switch (error.code) {
      case 'quota_exceeded':
        return m.quota_exceeded(inTime(error.retryAfterSec ?? 3600))
      case 'user_quota_exceeded':
        return m.user_quota_exceeded(inTime(error.retryAfterSec ?? 3600))
      default:
        return m[error.code]
    }
  }
  if (error instanceof DataError) {
    if (error.code === 'offline') return t.common.offlineAction
    if (error.code === 'not_found') return t.playlist.notFound
    return error.message || t.common.genericError
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return t.common.offlineAction
  return t.common.genericError
}
