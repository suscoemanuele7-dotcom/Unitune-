import { t } from '../i18n'

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return t.common.relative.now
  if (min < 60) return t.common.relative.minutes(min)
  const h = Math.floor(min / 60)
  if (h < 24) return t.common.relative.hours(h)
  return t.common.relative.days(Math.floor(h / 24))
}

export function inTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.ceil((seconds % 3600) / 60)
  return t.common.inTime(h, m)
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h >= 5 && h < 13) return t.home.morning
  if (h >= 13 && h < 18) return t.home.afternoon
  return t.home.evening
}
