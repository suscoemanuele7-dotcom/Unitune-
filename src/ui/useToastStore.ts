import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  kind: 'info' | 'error'
}

interface ToastState {
  toasts: Toast[]
  show: (message: string, kind?: Toast['kind']) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show(message, kind = 'info') {
    const id = nextId++
    // Evita doppioni identici uno sopra l'altro.
    const others = get().toasts.filter((x) => x.message !== message)
    set({ toasts: [...others.slice(-2), { id, message, kind }] })
    setTimeout(() => {
      get().dismiss(id)
    }, kind === 'error' ? 5000 : 3000)
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((x) => x.id !== id) })
  },
}))

export const toast = (message: string, kind?: Toast['kind']) => {
  useToastStore.getState().show(message, kind)
}
