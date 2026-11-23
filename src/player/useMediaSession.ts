/**
 * Media Session API: titolo, artista, artwork e comandi (cuffie, notifiche,
 * schermata di blocco).
 *
 * LIMITE NOTO: l'audio è prodotto dall'iframe di youtube.com (un'origine
 * diversa). Alcuni browser associano la sessione multimediale al frame che
 * suona e mostrano i metadati di YouTube al posto dei nostri, oppure fermano
 * la riproduzione quando l'app va in background. È un comportamento del
 * browser che non aggiriamo: questa integrazione è un miglioramento
 * progressivo, da verificare sul dispositivo.
 */
import { useEffect } from 'react'
import { displayInfo } from '../lib/trackDisplay'
import { usePlayerStore } from './usePlayerStore'
import { t } from '../i18n'

function supported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof MediaMetadata !== 'undefined'
}

export function useMediaSession(): void {
  const track = usePlayerStore((s) => s.queue.items[s.queue.index]?.track)
  const wantsToPlay = usePlayerStore((s) => s.wantsToPlay)
  const status = usePlayerStore((s) => s.status)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)

  // Metadati del brano.
  useEffect(() => {
    if (!supported()) return
    if (!track) {
      navigator.mediaSession.metadata = null
      return
    }
    const info = displayInfo(track)
    const base = `https://i.ytimg.com/vi/${track.videoId}`
    navigator.mediaSession.metadata = new MediaMetadata({
      title: info.title,
      artist: info.artist,
      album: t.appName,
      artwork: [
        { src: `${base}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
        { src: `${base}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
      ],
    })
  }, [track])

  // Comandi.
  useEffect(() => {
    if (!supported()) return
    const s = () => usePlayerStore.getState()
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => { s().play() }],
      ['pause', () => { s().pause() }],
      ['previoustrack', () => { s().previous() }],
      ['nexttrack', () => { s().next() }],
      ['seekto', (d) => { if (d.seekTime !== undefined) s().seek(d.seekTime) }],
      ['seekbackward', (d) => { s().seek(s().currentTime - (d.seekOffset ?? 10)) }],
      ['seekforward', (d) => { s().seek(s().currentTime + (d.seekOffset ?? 10)) }],
    ]
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Azione non supportata da questo browser.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // ignorato
        }
      }
    }
  }, [])

  // Stato di riproduzione.
  useEffect(() => {
    if (!supported()) return
    navigator.mediaSession.playbackState = !track ? 'none' : wantsToPlay ? 'playing' : 'paused'
  }, [track, wantsToPlay])

  // Posizione (barra di avanzamento nella notifica).
  useEffect(() => {
    if (!supported() || !track || duration <= 0 || status === 'loading') return
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(Math.max(0, currentTime), duration),
        playbackRate: 1,
      })
    } catch {
      // Valori non accettati dal browser: ignorato.
    }
  }, [track, currentTime, duration, status])
}
