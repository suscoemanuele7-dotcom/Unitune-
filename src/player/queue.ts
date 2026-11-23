/**
 * Logica della coda di riproduzione, come funzioni pure (immutabili e
 * testabili). Lo store Zustand le usa per aggiornare lo stato.
 */
import type { Track } from '../types'

export interface QueueItem {
  /** ID univoco della voce in coda (lo stesso brano può esserci due volte). */
  uid: string
  track: Track
}

export type RepeatMode = 'off' | 'all' | 'one'

export interface QueueState {
  items: QueueItem[]
  /** Indice del brano corrente, -1 se la coda è vuota. */
  index: number
  shuffle: boolean
  repeat: RepeatMode
  /** Ordine originale (uid) da ripristinare quando si disattiva lo shuffle. */
  originalOrder: string[] | null
}

export type Rng = () => number

export const emptyQueue: QueueState = { items: [], index: -1, shuffle: false, repeat: 'off', originalOrder: null }

let counter = 0
export function makeItem(track: Track): QueueItem {
  counter += 1
  return { uid: `${Date.now().toString(36)}-${counter.toString(36)}`, track }
}

/** Fisher–Yates. */
export function shuffled<T>(list: readonly T[], rng: Rng): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

export function currentItem(q: QueueState): QueueItem | undefined {
  return q.items[q.index]
}

/** Nuova coda da una lista (es. playlist o risultati di ricerca). */
export function setQueue(
  q: QueueState,
  tracks: readonly Track[],
  startIndex: number,
  rng: Rng,
  shuffle = q.shuffle,
): QueueState {
  const items = tracks.map(makeItem)
  if (items.length === 0) return { ...q, items: [], index: -1, originalOrder: null, shuffle }
  const start = Math.min(Math.max(0, startIndex), items.length - 1)
  if (!shuffle) return { ...q, items, index: start, shuffle, originalOrder: null }
  const first = items[start] as QueueItem
  const rest = shuffled(
    items.filter((_, i) => i !== start),
    rng,
  )
  return { ...q, items: [first, ...rest], index: 0, shuffle, originalOrder: items.map((i) => i.uid) }
}

/**
 * Indice del brano successivo, o null se la coda è finita.
 * `auto` = fine naturale del brano (rispetta "ripeti brano").
 */
export function nextIndex(q: QueueState, auto: boolean): number | null {
  if (q.items.length === 0) return null
  if (auto && q.repeat === 'one') return q.index
  if (q.index + 1 < q.items.length) return q.index + 1
  return q.repeat === 'off' ? null : 0
}

export function previousIndex(q: QueueState): number {
  if (q.items.length === 0) return -1
  if (q.index > 0) return q.index - 1
  return q.repeat === 'all' ? q.items.length - 1 : 0
}

export function toggleShuffle(q: QueueState, rng: Rng): QueueState {
  if (q.items.length === 0) return { ...q, shuffle: !q.shuffle, originalOrder: null }
  if (!q.shuffle) {
    // Mescola solo i brani dopo quello corrente.
    const before = q.items.slice(0, q.index + 1)
    const after = shuffled(q.items.slice(q.index + 1), rng)
    return { ...q, shuffle: true, items: [...before, ...after], originalOrder: q.items.map((i) => i.uid) }
  }
  const order = q.originalOrder ?? []
  const pos = new Map(order.map((uid, i) => [uid, i]))
  // Le voci aggiunte durante lo shuffle finiscono in fondo, nell'ordine attuale.
  const restored = [...q.items].sort((a, b) => (pos.get(a.uid) ?? Infinity) - (pos.get(b.uid) ?? Infinity))
  const current = currentItem(q)
  return {
    ...q,
    shuffle: false,
    items: restored,
    index: current ? restored.findIndex((i) => i.uid === current.uid) : -1,
    originalOrder: null,
  }
}

export function cycleRepeat(q: QueueState): QueueState {
  const next: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' }
  return { ...q, repeat: next[q.repeat] }
}

export function addToEnd(q: QueueState, tracks: readonly Track[]): QueueState {
  const added = tracks.map(makeItem)
  return {
    ...q,
    items: [...q.items, ...added],
    index: q.index === -1 && added.length > 0 ? 0 : q.index,
    originalOrder: q.originalOrder ? [...q.originalOrder, ...added.map((a) => a.uid)] : null,
  }
}

export function insertNext(q: QueueState, track: Track): QueueState {
  const item = makeItem(track)
  const at = q.index + 1
  const items = [...q.items.slice(0, at), item, ...q.items.slice(at)]
  let originalOrder = q.originalOrder
  if (originalOrder) {
    const current = currentItem(q)
    const cur = current ? originalOrder.indexOf(current.uid) : -1
    originalOrder = [...originalOrder.slice(0, cur + 1), item.uid, ...originalOrder.slice(cur + 1)]
  }
  return { ...q, items, index: q.index === -1 ? 0 : q.index, originalOrder }
}

/** Rimuove una voce. Se è quella corrente, il corrente diventa la successiva. */
export function removeItem(q: QueueState, uid: string): { queue: QueueState; removedCurrent: boolean } {
  const i = q.items.findIndex((x) => x.uid === uid)
  if (i === -1) return { queue: q, removedCurrent: false }
  const items = q.items.filter((x) => x.uid !== uid)
  const originalOrder = q.originalOrder?.filter((x) => x !== uid) ?? null
  let index = q.index
  if (i < q.index) index -= 1
  if (index >= items.length) index = items.length - 1
  return { queue: { ...q, items, index, originalOrder }, removedCurrent: i === q.index }
}

export function moveItem(q: QueueState, from: number, to: number): QueueState {
  if (from === to || from < 0 || to < 0 || from >= q.items.length || to >= q.items.length) return q
  const items = [...q.items]
  const [moved] = items.splice(from, 1)
  if (!moved) return q
  items.splice(to, 0, moved)
  let index = q.index
  if (from === q.index) index = to
  else if (from < q.index && to >= q.index) index -= 1
  else if (from > q.index && to <= q.index) index += 1
  return { ...q, items, index }
}
