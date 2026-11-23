/**
 * Tipi (parziali, solo ciò che usiamo) della YouTube IFrame Player API.
 * Riferimento: https://developers.google.com/youtube/iframe_api_reference
 */

export const YTState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

export interface YTPlayerInstance {
  loadVideoById: (videoId: string, startSeconds?: number) => void
  cueVideoById: (videoId: string, startSeconds?: number) => void
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  setVolume: (volume: number) => void
  getVolume(): number
  mute: () => void
  unMute: () => void
  isMuted: () => boolean
  destroy: () => void
}

export interface YTPlayerEvent {
  target: YTPlayerInstance
}

export interface YTOnStateChangeEvent extends YTPlayerEvent {
  data: number
}

export interface YTOnErrorEvent extends YTPlayerEvent {
  data: number
}

export interface YTPlayerOptions {
  width?: string | number
  height?: string | number
  videoId?: string
  host?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: YTPlayerEvent) => void
    onStateChange?: (event: YTOnStateChangeEvent) => void
    onError?: (event: YTOnErrorEvent) => void
    onAutoplayBlocked?: (event: YTPlayerEvent) => void
  }
}

export interface YTNamespace {
  Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayerInstance
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}
