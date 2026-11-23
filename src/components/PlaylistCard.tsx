import { Link } from 'react-router'
import type { PlaylistSummary } from '../types'
import { Cover } from './Cover'
import { t } from '../i18n'

/** Card verticale per gli scaffali orizzontali della Home. */
export function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  return (
    <Link to={`/playlist/${playlist.id}`} className="block w-36 shrink-0 space-y-2 active:opacity-80">
      <Cover urls={playlist.coverUrls} alt={playlist.name} className="aspect-square w-36 shadow-lg" />
      <div>
        <p className="truncate text-sm font-semibold">{playlist.name}</p>
        <p className="truncate text-xs text-muted">
          {playlist.description || `${t.library.by(playlist.ownerName)} · ${t.library.songs(playlist.trackCount)}`}
        </p>
      </div>
    </Link>
  )
}

/** Riga per la libreria. */
export function PlaylistRow({ playlist, showOwner = false }: { playlist: PlaylistSummary; showOwner?: boolean }) {
  return (
    <Link to={`/playlist/${playlist.id}`} className="flex items-center gap-3 rounded-lg py-1.5 active:bg-surface">
      <Cover urls={playlist.coverUrls} alt="" className="h-14 w-14" rounded="rounded" />
      <div className="min-w-0">
        <p className="truncate font-medium">{playlist.name}</p>
        <p className="truncate text-[13px] text-muted">
          {showOwner ? `${t.library.by(playlist.ownerName)} · ` : ''}
          {t.library.songs(playlist.trackCount)}
          {playlist.isUniversity ? ` · ${t.playlist.university}` : playlist.isPublic ? ` · ${t.playlist.public}` : ''}
        </p>
      </div>
    </Link>
  )
}
