import { useState, type CSSProperties } from 'react'
import { formatDuration } from '../lib/trackDisplay'
import { usePlayerStore } from '../player/usePlayerStore'
import { supportsVolumeControl } from '../player/YouTubePlayer'
import { NextIcon, PauseIcon, PlayIcon, PrevIcon, RepeatIcon, ShuffleIcon, SparkleIcon, VolumeIcon } from './icons'
import { t } from '../i18n'

export function SeekBar() {
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const seek = usePlayerStore((s) => s.seek)
  const [dragValue, setDragValue] = useState<number | null>(null)
  const value = dragValue ?? currentTime
  const max = Math.max(duration, 1)
  const commit = () => {
    if (dragValue !== null) seek(dragValue)
    setDragValue(null)
  }

  return (
    <div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={Math.min(value, max)}
        aria-label={t.player.seek}
        aria-valuetext={`${formatDuration(value)} / ${formatDuration(duration)}`}
        disabled={duration <= 0}
        onChange={(e) => {
          setDragValue(Number(e.target.value))
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="range w-full"
        style={{ '--progress': `${(Math.min(value, max) / max) * 100}%` } as CSSProperties}
      />
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted">
        <span>{formatDuration(value)}</span>
        <span>{formatDuration(duration > 0 ? duration : null)}</span>
      </div>
    </div>
  )
}

export function PlayPauseButton({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const wantsToPlay = usePlayerStore((s) => s.wantsToPlay)
  const status = usePlayerStore((s) => s.status)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const busy = wantsToPlay && (status === 'loading' || status === 'buffering')
  const label = wantsToPlay ? t.player.pause : t.player.play
  const big = size === 'lg'
  return (
    <button
      type="button"
      onClick={togglePlay}
      aria-label={label}
      title={label}
      className={`relative inline-flex items-center justify-center rounded-full transition active:scale-90 ${
        big ? 'h-16 w-16 bg-text text-bg' : 'h-10 w-10 text-text'
      }`}
    >
      {busy && (
        <span
          aria-hidden
          className={`absolute inset-0 animate-spin rounded-full border-2 border-transparent ${big ? 'border-t-accent' : 'border-t-text/70'}`}
        />
      )}
      {wantsToPlay ? <PauseIcon size={big ? 28 : 22} /> : <PlayIcon size={big ? 28 : 22} />}
    </button>
  )
}

export function TransportControls() {
  const shuffle = usePlayerStore((s) => s.queue.shuffle)
  const smart = usePlayerStore((s) => s.queue.smart)
  const smartLoading = usePlayerStore((s) => s.smartLoading)
  const repeat = usePlayerStore((s) => s.queue.repeat)
  const s = usePlayerStore.getState
  const repeatLabel = repeat === 'off' ? t.player.repeatOff : repeat === 'all' ? t.player.repeatAll : t.player.repeatOne

  return (
    <div className="flex items-center justify-between">
      {/* Un tocco: casuale → Smart Shuffle → spento. */}
      <button
        type="button"
        className={`icon-btn relative ${shuffle ? 'text-accent hover:text-accent' : ''}`}
        aria-label={smart ? t.player.smartOn : shuffle ? t.player.shuffleOn : t.player.shuffleOff}
        aria-pressed={shuffle}
        aria-busy={smartLoading}
        title={smart ? t.player.smartOn : shuffle ? t.player.shuffleOn : t.player.shuffleOff}
        onClick={() => {
          s().cycleShuffle()
        }}
      >
        <ShuffleIcon />
        {smart && <SparkleIcon size={12} className={`absolute right-0.5 top-0.5 text-accent-2 ${smartLoading ? 'animate-pulse' : ''}`} />}
        {shuffle && <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
      </button>
      <button type="button" className="icon-btn text-text" aria-label={t.player.previous} onClick={() => { s().previous() }}>
        <PrevIcon size={32} />
      </button>
      <PlayPauseButton />
      <button type="button" className="icon-btn text-text" aria-label={t.player.next} onClick={() => { s().next() }}>
        <NextIcon size={32} />
      </button>
      <button
        type="button"
        className={`icon-btn relative ${repeat !== 'off' ? 'text-accent hover:text-accent' : ''}`}
        aria-label={repeatLabel}
        aria-pressed={repeat !== 'off'}
        onClick={() => {
          s().cycleRepeat()
        }}
      >
        <RepeatIcon one={repeat === 'one'} />
        {repeat !== 'off' && <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
      </button>
    </div>
  )
}

/** Volume: solo dove l'IFrame API lo supporta (non su iOS). */
export function VolumeControl() {
  const volume = usePlayerStore((s) => s.volume)
  const muted = usePlayerStore((s) => s.muted)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const toggleMute = usePlayerStore((s) => s.toggleMute)
  if (!supportsVolumeControl()) return null
  const shown = muted ? 0 : volume
  return (
    <div className="flex items-center gap-3">
      <button type="button" className="icon-btn" onClick={toggleMute} aria-label={muted ? t.player.unmute : t.player.mute}>
        <VolumeIcon muted={muted || volume === 0} size={20} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={shown}
        aria-label={t.player.volume}
        onChange={(e) => {
          const v = Number(e.target.value)
          setVolume(v)
          if (muted && v > 0) toggleMute()
        }}
        className="range flex-1"
        style={{ '--progress': `${shown}%` } as CSSProperties}
      />
    </div>
  )
}
