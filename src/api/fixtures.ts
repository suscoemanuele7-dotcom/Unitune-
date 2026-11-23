import type { Track } from '../types'
import { youtubeWatchUrl } from '../../supabase/functions/_shared/contract.ts'

/**
 * Catalogo YouTube DIMOSTRATIVO usato quando la ricerca YouTube reale non è
 * configurata (VITE_USE_MOCKS=true o modalità demo). La ricerca su Audius è
 * invece sempre reale: la sua API pubblica non richiede chiavi. Contiene solo metadati pubblici di
 * video ufficiali: la riproduzione avviene comunque con il player IFrame
 * ufficiale, quindi rispetta le stesse regole dell'app reale. Se un video
 * venisse rimosso o reso non incorporabile, il player lo segnalerà con
 * l'errore corrispondente (utile anche per provare la gestione errori).
 */
function t(videoId: string, title: string, channelTitle: string, durationSec: number): Track {
  return {
    source: 'youtube',
    id: videoId,
    title,
    channelTitle,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    durationSec,
    externalUrl: youtubeWatchUrl(videoId),
  }
}

export const demoCatalog: readonly Track[] = [
  t('dQw4w9WgXcQ', 'Rick Astley - Never Gonna Give You Up (Official Video)', 'Rick Astley', 213),
  t('fJ9rUzIMcZQ', 'Queen – Bohemian Rhapsody (Official Video Remastered)', 'Queen Official', 359),
  t('hTWKbfoikeg', 'Nirvana - Smells Like Teen Spirit (Official Music Video)', 'Nirvana', 301),
  t('YQHsXMglC9A', 'Adele - Hello (Official Music Video)', 'Adele', 367),
  t('OPf0YbXqDm0', 'Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars', 'Mark Ronson', 271),
  t('kJQP7kiw5Fk', 'Luis Fonsi - Despacito ft. Daddy Yankee', 'Luis Fonsi', 282),
  t('JGwWNGJdvx8', 'Ed Sheeran - Shape of You (Official Music Video)', 'Ed Sheeran', 263),
  t('2Vv-BfVoq4g', 'Ed Sheeran - Perfect (Official Music Video)', 'Ed Sheeran', 280),
  t('lp-EO5I60KA', 'Ed Sheeran - Thinking Out Loud (Official Music Video)', 'Ed Sheeran', 297),
  t('60ItHLz5WEA', 'Alan Walker - Faded', 'Alan Walker', 212),
  t('RgKAFK5djSk', 'Wiz Khalifa - See You Again ft. Charlie Puth [Official Video]', 'Wiz Khalifa', 237),
  t('hT_nvWreIhg', 'OneRepublic - Counting Stars (Official Music Video)', 'OneRepublic', 284),
  t('09R8_2nJtjg', 'Maroon 5 - Sugar (Official Music Video)', 'Maroon 5', 302),
  t('nfWlot6h_JM', 'Taylor Swift - Shake It Off', 'Taylor Swift', 242),
  t('kXYiU_JCYtU', 'Numb (Official Music Video) [4K UPGRADE] – Linkin Park', 'Linkin Park', 187),
  t('1G4isv_Fylg', 'Coldplay - Paradise (Official Video)', 'Coldplay', 261),
  t('YykjpeuMNEk', 'Coldplay - Hymn For The Weekend (Official Video)', 'Coldplay', 261),
  t('CevxZvSJLk8', 'Katy Perry - Roar (Official)', 'Katy Perry', 270),
  t('pRpeEdMmmQ0', 'Shakira - Waka Waka (This Time for Africa)', 'Shakira', 211),
  t('uelHwf8o7_U', 'Eminem - Love The Way You Lie ft. Rihanna', 'Eminem', 267),
  t('9bZkp7q19f0', 'PSY - GANGNAM STYLE (강남스타일) M/V', 'officialpsy', 253),
]

function pick(...ids: string[]): Track[] {
  return ids.flatMap((id) => {
    const track = demoCatalog.find((x) => x.id === id)
    return track ? [track] : []
  })
}

/** Playlist "dell'università" precaricate in modalità demo. */
export const demoUniversityPlaylists: readonly { id: string; name: string; description: string; tracks: Track[] }[] = [
  {
    id: 'demo-uni-studio',
    name: 'Sessione esami',
    description: 'Per le lunghe giornate in biblioteca.',
    tracks: pick('YQHsXMglC9A', '1G4isv_Fylg', '2Vv-BfVoq4g', '60ItHLz5WEA', 'lp-EO5I60KA'),
  },
  {
    id: 'demo-uni-festa',
    name: 'Festa di fine sessione',
    description: 'Gli esami sono finiti: si balla.',
    tracks: pick('OPf0YbXqDm0', 'kJQP7kiw5Fk', 'nfWlot6h_JM', 'pRpeEdMmmQ0', '9bZkp7q19f0', 'CevxZvSJLk8'),
  },
  {
    id: 'demo-uni-classici',
    name: 'Classici del campus',
    description: 'Le canzoni che tutti conoscono.',
    tracks: pick('fJ9rUzIMcZQ', 'hTWKbfoikeg', 'dQw4w9WgXcQ', 'kXYiU_JCYtU'),
  },
]
