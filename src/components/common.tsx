import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { t } from '../i18n'

export function Spinner({ label = t.common.loading }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-8 text-sm text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden />
      {label}
    </div>
  )
}

export function EmptyState({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-surface/60 px-6 py-8 text-center text-sm text-muted">
      {icon && <div className="text-muted/80">{icon}</div>}
      <p className="max-w-xs">{children}</p>
      {action}
    </div>
  )
}

export function SectionHeader({ title, to }: { title: string; to?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {to && (
        <Link to={to} className="shrink-0 text-xs font-semibold text-muted hover:text-text">
          {t.common.seeAll}
        </Link>
      )}
    </div>
  )
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold text-text underline">
          {t.common.retry}
        </button>
      )}
    </div>
  )
}

export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div role="status" className="bg-amber-500/15 px-4 py-2 text-center text-xs font-medium text-amber-200">
      {t.offline.banner}
    </div>
  )
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {actions}
    </div>
  )
}
