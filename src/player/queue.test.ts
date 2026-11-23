import { describe, expect, it } from 'vitest'
import type { Track } from '../types'
import {
  addToEnd,
  currentItem,
  cycleRepeat,
  emptyQueue,
  insertNext,
  moveItem,
  nextIndex,
  previousIndex,
  removeItem,
  setQueue,
  shuffled,
  toggleShuffle,
  type QueueState,
} from './queue'

const tr = (n: number): Track => ({
  videoId: `video${String(n).padStart(6, '0')}`,
  title: `Brano ${n}`,
  channelTitle: 'Artista',
  thumbnailUrl: '',
  durationSec: 100,
})
const tracks = [1, 2, 3, 4, 5].map(tr)
const titles = (q: QueueState) => q.items.map((i) => i.track.title)

/** RNG deterministico. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('setQueue', () => {
  it('imposta lista e brano iniziale', () => {
    const q = setQueue(emptyQueue, tracks, 2, seeded(1))
    expect(q.index).toBe(2)
    expect(currentItem(q)?.track.title).toBe('Brano 3')
  })
  it('con shuffle il brano scelto è il primo e gli altri sono tutti presenti', () => {
    const q = setQueue({ ...emptyQueue, shuffle: true }, tracks, 3, seeded(7))
    expect(q.index).toBe(0)
    expect(currentItem(q)?.track.title).toBe('Brano 4')
    expect([...titles(q)].sort()).toEqual(tracks.map((t) => t.title).sort())
  })
  it('lista vuota → coda vuota', () => {
    expect(setQueue(emptyQueue, [], 0, seeded(1)).index).toBe(-1)
  })
})

describe('next / previous / repeat', () => {
  const q = setQueue(emptyQueue, tracks, 4, seeded(1))
  it('fine coda senza ripetizione → null', () => {
    expect(nextIndex(q, true)).toBeNull()
  })
  it('ripeti tutto → ricomincia', () => {
    expect(nextIndex({ ...q, repeat: 'all' }, true)).toBe(0)
  })
  it('ripeti brano: solo a fine naturale, non con "avanti"', () => {
    expect(nextIndex({ ...q, index: 1, repeat: 'one' }, true)).toBe(1)
    expect(nextIndex({ ...q, index: 1, repeat: 'one' }, false)).toBe(2)
  })
  it('precedente', () => {
    expect(previousIndex({ ...q, index: 2 })).toBe(1)
    expect(previousIndex({ ...q, index: 0 })).toBe(0)
    expect(previousIndex({ ...q, index: 0, repeat: 'all' })).toBe(4)
  })
  it('cicla le modalità di ripetizione', () => {
    expect(cycleRepeat(cycleRepeat(cycleRepeat(q))).repeat).toBe('off')
    expect(cycleRepeat(q).repeat).toBe('all')
  })
})

describe('shuffle', () => {
  it('mescola solo i brani dopo il corrente e ripristina l’ordine', () => {
    const q = setQueue(emptyQueue, tracks, 1, seeded(1))
    const on = toggleShuffle(q, seeded(3))
    expect(titles(on).slice(0, 2)).toEqual(['Brano 1', 'Brano 2'])
    expect([...titles(on)].sort()).toEqual(titles(q))
    const moved = { ...on, index: 3 }
    const playing = currentItem(moved)?.uid
    const off = toggleShuffle(moved, seeded(3))
    expect(titles(off)).toEqual(titles(q))
    expect(currentItem(off)?.uid).toBe(playing)
  })
  it('le voci aggiunte durante lo shuffle restano dopo il ripristino', () => {
    const q = toggleShuffle(setQueue(emptyQueue, tracks.slice(0, 3), 0, seeded(1)), seeded(2))
    const off = toggleShuffle(addToEnd(q, [tr(9)]), seeded(2))
    expect(titles(off)).toEqual(['Brano 1', 'Brano 2', 'Brano 3', 'Brano 9'])
  })
  it('Fisher–Yates mantiene tutti gli elementi', () => {
    expect(shuffled([1, 2, 3, 4], seeded(5)).sort()).toEqual([1, 2, 3, 4])
  })
})

describe('modifica della coda', () => {
  it('insertNext mette il brano subito dopo il corrente', () => {
    const q = insertNext(setQueue(emptyQueue, tracks, 1, seeded(1)), tr(9))
    expect(titles(q)[2]).toBe('Brano 9')
    expect(q.index).toBe(1)
  })
  it('insertNext su coda vuota la avvia', () => {
    const q = insertNext(emptyQueue, tr(9))
    expect(q.index).toBe(0)
  })
  it('removeItem prima del corrente sposta l’indice', () => {
    const q = setQueue(emptyQueue, tracks, 2, seeded(1))
    const first = q.items[0]?.uid ?? ''
    const { queue, removedCurrent } = removeItem(q, first)
    expect(removedCurrent).toBe(false)
    expect(currentItem(queue)?.track.title).toBe('Brano 3')
  })
  it('removeItem del corrente passa al successivo', () => {
    const q = setQueue(emptyQueue, tracks, 2, seeded(1))
    const { queue, removedCurrent } = removeItem(q, q.items[2]?.uid ?? '')
    expect(removedCurrent).toBe(true)
    expect(currentItem(queue)?.track.title).toBe('Brano 4')
  })
  it('removeItem dell’ultimo corrente', () => {
    const q = setQueue(emptyQueue, tracks, 4, seeded(1))
    const { queue } = removeItem(q, q.items[4]?.uid ?? '')
    expect(queue.index).toBe(3)
  })
  it('moveItem aggiorna l’indice corrente', () => {
    const q = setQueue(emptyQueue, tracks, 2, seeded(1))
    expect(currentItem(moveItem(q, 2, 0))?.track.title).toBe('Brano 3')
    expect(moveItem(q, 2, 0).index).toBe(0)
    expect(moveItem(q, 0, 4).index).toBe(1)
    expect(moveItem(q, 4, 0).index).toBe(3)
    expect(moveItem(q, 9, 0)).toBe(q)
  })
})
