import { create } from 'zustand'
import type { ReactNode } from 'react'
import type { Track } from '../types'

export interface ExtraAction {
  label: string
  icon: ReactNode
  onSelect: () => void
  destructive?: boolean
}

interface TrackMenuState {
  track: Track | null
  extra: ExtraAction[]
  open: (track: Track, extra?: ExtraAction[]) => void
  close: () => void
}

/** Un solo menu azioni per tutta l'app (montato in AppShell). */
export const useTrackMenu = create<TrackMenuState>()((set) => ({
  track: null,
  extra: [],
  open(track, extra = []) {
    set({ track, extra })
  },
  close() {
    set({ track: null, extra: [] })
  },
}))
