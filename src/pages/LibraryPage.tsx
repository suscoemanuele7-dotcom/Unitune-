import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuthStore } from '../auth/useAuthStore'
import { BottomSheet, SheetAction } from '../components/BottomSheet'
import { EmptyState, ErrorNotice, PageHeader } from '../components/common'
import { PlaylistRow } from '../components/PlaylistCard'
import { PlaylistFormSheet } from '../components/PlaylistFormSheet'
import { ClockIcon, DownloadIcon, HeartIcon, PlusIcon, SettingsIcon } from '../components/icons'
import { useLibraryStore } from '../data/useLibraryStore'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { errorMessage } from '../lib/errors'
import { usePlayerStore } from '../player/usePlayerStore'
import { useCanInstall, useInstallPrompt } from '../pwa/useInstallPrompt'
import { toast } from '../ui/useToastStore'
import { t } from '../i18n'

export function LibraryPage() {
  const myPlaylists = useLibraryStore((s) => s.myPlaylists)
  const saved = useLibraryStore((s) => s.savedPlaylists)
  const favoritesCount = useLibraryStore((s) => s.favorites.length)
  const lastError = useLibraryStore((s) => s.lastError)
  const online = useOnlineStatus()
  const [formOpen, setFormOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        title={t.library.title}
        actions={
          <div className="flex gap-1">
            <button
              type="button"
              className="icon-btn"
              aria-label={t.library.newPlaylist}
              onClick={() => {
                setFormOpen(true)
              }}
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t.library.settings}
              onClick={() => {
                setSettingsOpen(true)
              }}
            >
              <SettingsIcon />
            </button>
          </div>
        }
      />

      {lastError && lastError !== 'offline' && online && (
        <div className="mb-4">
          <ErrorNotice
            message={t.library.syncError}
            onRetry={() => {
              void useLibraryStore.getState().refresh()
            }}
          />
        </div>
      )}

      <div className="space-y-1">
        <Link to="/library/favorites" className="flex items-center gap-3 rounded-lg py-1.5 active:bg-surface">
          <span className="flex h-14 w-14 items-center justify-center rounded bg-gradient-to-br from-accent to-accent-2 text-white">
            <HeartIcon filled />
          </span>
          <span>
            <span className="block font-medium">{t.library.liked}</span>
            <span className="block text-[13px] text-muted">{t.library.songs(favoritesCount)}</span>
          </span>
        </Link>
        <Link to="/library/history" className="flex items-center gap-3 rounded-lg py-1.5 active:bg-surface">
          <span className="flex h-14 w-14 items-center justify-center rounded bg-surface-2 text-muted">
            <ClockIcon />
          </span>
          <span className="font-medium">{t.library.history}</span>
        </Link>
      </div>

      <h2 className="mb-2 mt-7 text-lg font-bold">{t.library.myPlaylists}</h2>
      {myPlaylists.length === 0 ? (
        <EmptyState
          action={
            <button
              type="button"
              className="btn-secondary py-2 text-sm"
              onClick={() => {
                setFormOpen(true)
              }}
            >
              <PlusIcon size={18} /> {t.library.newPlaylist}
            </button>
          }
        >
          {t.library.emptyPlaylists}
        </EmptyState>
      ) : (
        <div className="space-y-1">
          {myPlaylists.map((p) => (
            <PlaylistRow key={p.id} playlist={p} />
          ))}
        </div>
      )}

      {saved.length > 0 && (
        <>
          <h2 className="mb-2 mt-7 text-lg font-bold">{t.library.saved}</h2>
          <div className="space-y-1">
            {saved.map((p) => (
              <PlaylistRow key={p.id} playlist={p} showOwner />
            ))}
          </div>
        </>
      )}

      <PlaylistFormSheet
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
        }}
        onSubmit={async (input) => {
          try {
            const created = await useLibraryStore.getState().createPlaylist(input)
            void navigate(`/playlist/${created.id}`)
          } catch (error) {
            toast(errorMessage(error), 'error')
          }
        }}
      />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
        }}
      />
    </div>
  )
}

function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const backend = useAuthStore((s) => s.backend)
  const signOut = useAuthStore((s) => s.signOut)
  const canInstall = useCanInstall()
  const promptInstall = useInstallPrompt((s) => s.promptInstall)

  return (
    <BottomSheet open={open} onClose={onClose} title={t.library.settings}>
      <div className="mb-2 border-b border-border px-3 pb-3">
        <p className="font-semibold">{user?.displayName}</p>
        {user?.email && <p className="text-sm text-muted">{user.email}</p>}
        {backend === 'local' && <p className="mt-1 text-xs text-amber-300">{t.library.demoBadge}</p>}
      </div>
      {canInstall === 'prompt' && (
        <SheetAction
          icon={<DownloadIcon />}
          label={t.pwa.install}
          onClick={() => {
            onClose()
            void promptInstall()
          }}
        />
      )}
      {canInstall === 'ios' && <p className="px-3 py-2 text-sm text-muted">{t.pwa.installIos}</p>}
      <SheetAction
        icon={<span className="block w-6 text-center">⎋</span>}
        label={t.auth.signOut}
        destructive
        onClick={() => {
          onClose()
          usePlayerStore.getState().clearQueue()
          void signOut()
        }}
      />
    </BottomSheet>
  )
}
