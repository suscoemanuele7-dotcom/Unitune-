import type { Track } from '../types'

/**
 * I titoli dei video musicali hanno spesso la forma
 * "Artista - Titolo (Official Video) [4K]". Per un'esperienza "da app
 * musicale" ricaviamo titolo e artista puliti, senza alterare i dati salvati.
 */
const NOISE =
  /\s*[([](?:[^)\]]*\b(?:official|video|audio|lyrics?|testo|visuali[sz]er|4k|hd|hq|remaster(?:ed)?|m\/v|mv|upgrade)\b[^)\]]*)[)\]]/gi

function clean(text: string): string {
  return text.replace(NOISE, '').replace(/\s{2,}/g, ' ').trim()
}

function cleanChannel(channel: string): string {
  return channel
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/, '')
    .replace(/\s+Official$/i, '')
    .trim()
}

export interface DisplayInfo {
  title: string
  artist: string
}

export function displayInfo(track: Pick<Track, 'title' | 'channelTitle'> & { source?: Track['source'] }): DisplayInfo {
  // Su Audius titolo e artista sono già separati e puliti.
  if (track.source === 'audius') return { title: track.title, artist: track.channelTitle }
  const cleaned = clean(track.title)
  const parts = cleaned.split(/\s+[-–—]\s+/)
  if (parts.length >= 2) {
    const [first = '', ...rest] = parts
    const second = rest.join(' - ')
    // "Numb – Linkin Park": se la seconda parte coincide col canale, è l'artista.
    const channel = cleanChannel(track.channelTitle).toLowerCase()
    if (channel && second.toLowerCase() === channel) return { title: first, artist: second }
    return { title: second || cleaned, artist: first }
  }
  return { title: cleaned || track.title, artist: cleanChannel(track.channelTitle) }
}

export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || !Number.isFinite(totalSec) || totalSec < 0) return '--:--'
  const s = Math.floor(totalSec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
