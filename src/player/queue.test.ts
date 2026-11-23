import { describe, expect, it } from 'vitest'
import type { Track } from '../types'
import {
  addToEnd,
  currentItem,
  cycleRepeat,
  emptyQueue,
  injectRecommended,
  insertNext,
  moveItem,
  nextBackgroundIndex,
  nextIndex,
  previousIndex,
  removeItem,
  removeRecommended,
  setQueue,
  shuffled,
  toggleShuffle,
  type QueueState,
} from './queue'

const tr = (n: number, source: Track['source'] = 'youtube'): Track => ({
  source,
  id: `video${String(n).padStart(6, '0')}`,
  title: `Brano ${n}`,
  channelTitle: 'Artista',
  thumbnailUrl: '',
  durationSec: 100,
  externalUrl: '',
})
const tracks = [1, 2, 3, 4, 5].map((n) => tr(n))
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

describe('background', () => {
  // y = YouTube, a = Audius
  const mixed = [tr(1, 'youtube'), tr(2, 'audius'), tr(3, 'youtube'), tr(4, 'youtube'), tr(5, 'audius')]
  it('salta i brani YouTube e va al prossimo Audius', () => {
    const q = setQueue(emptyQueue, mixed, 1, seeded(1))
    expect(nextBackgroundIndex(q)).toBe(4)
  })
  it('a fine coda: null senza ripetizione, ricomincia con "ripeti tutto"', () => {
    const q = setQueue(emptyQueue, mixed, 4, seeded(1))
    expect(nextBackgroundIndex(q)).toBeNull()
    expect(nextBackgroundIndex({ ...q, repeat: 'all' })).toBe(1)
  })
  it('ripeti brano: solo se il corrente è Audius', () => {
    const q = setQueue(emptyQueue, mixed, 1, seeded(1))
    expect(nextBackgroundIndex({ ...q, repeat: 'one' })).toBe(1)
    expect(nextBackgroundIndex({ ...q, index: 0, repeat: 'one' })).toBeNull()
  })
  it('nessun brano Audius → null', () => {
    expect(nextBackgroundIndex(setQueue(emptyQueue, tracks, 0, seeded(1)))).toBeNull()
  })
})

describe('Smart Shuffle', () => {
  const recs = [tr(91), tr(92), tr(93), tr(94)]
  it('inserisce un consigliato ogni 3 brani, dopo il corrente', () => {
    const base = setQueue(emptyQueue, [1, 2, 3, 4, 5, 6, 7].map((n) => tr(n)), 0, seeded(1))
    const q = injectRecommended(base, recs, 3)
    expect(titles(q)).toEqual(['Brano 1', 'Brano 2', 'Brano 3', 'Brano 91', 'Brano 4', 'Brano 5', 'Brano 6', 'Brano 92', 'Brano 7'])
    expect(q.items.filter((i) => i.recommended).length).toBe(2)
    expect(q.index).toBe(0)
  })
  it('non duplica brani già in coda', () => {
    const base = setQueue(emptyQueue, [tr(1), tr(2), tr(3)], 0, seeded(1))
    const q = injectRecommended(base, [tr(2), tr(91)], 3)
    expect(titles(q).filter((x) => x === 'Brano 2')).toHaveLength(1)
    expect(titles(q)).toContain('Brano 91')
  })
  it('coda corta: almeno un consigliato in fondo', () => {
    const q = injectRecommended(setQueue(emptyQueue, [tr(1)], 0, seeded(1)), recs, 3)
    expect(titles(q)).toEqual(['Brano 1', 'Brano 91'])
  })
  it('rimuove i consigliati futuri ma non quello in riproduzione', () => {
    const base = setQueue(emptyQueue, [1, 2, 3, 4, 5, 6, 7].map((n) => tr(n)), 0, seeded(1))
    const injected = injectRecommended(base, recs, 3)
    const playingRec = { ...injected, index: 3 } // "Brano 91"
    const cleaned = removeRecommended(playingRec)
    expect(titles(cleaned)).toEqual(['Brano 1', 'Brano 2', 'Brano 3', 'Brano 91', 'Brano 4', 'Brano 5', 'Brano 6', 'Brano 7'])
    expect(currentItem(cleaned)?.track.title).toBe('Brano 91')
  })
})
