import { create } from 'zustand'

/**
 * Posizione dell'unico iframe del player (mai smontato, per non
 * interrompere la riproduzione cambiando pagina).
 */
interface PlayerLayoutState {
  /** Riquadro nella schermata full-screen dove "agganciare" il player. */
  fullscreenSlot: HTMLElement | null
  /** Numero di pannelli/modali aperti: il player flottante si sposta in alto. */
  overlays: number
  side: 'left' | 'right'
  setFullscreenSlot: (el: HTMLElement | null) => void
  pushOverlay: () => void
  popOverlay: () => void
  setSide: (side: 'left' | 'right') => void
}

export const usePlayerLayout = create<PlayerLayoutState>()((set, get) => ({
  fullscreenSlot: null,
  overlays: 0,
  side: 'right',
  setFullscreenSlot(el) {
    set({ fullscreenSlot: el })
  },
  pushOverlay() {
    set({ overlays: get().overlays + 1 })
  },
  popOverlay() {
    set({ overlays: Math.max(0, get().overlays - 1) })
  },
  setSide(side) {
    set({ side })
  },
}))
