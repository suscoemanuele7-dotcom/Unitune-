import { useState } from 'react'
import { MusicIcon } from './icons'

interface CoverProps {
  urls: readonly string[]
  alt?: string
  className?: string
  rounded?: string
}

/** Copertina: immagine singola o mosaico 2×2 (come le playlist). */
export function Cover({ urls, alt = '', className = '', rounded = 'rounded-md' }: CoverProps) {
  const images = urls.filter(Boolean)
  const base = `relative shrink-0 overflow-hidden bg-surface-2 ${rounded} ${className}`

  if (images.length === 0) {
    return (
      <div className={`${base} flex items-center justify-center text-muted`} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <MusicIcon size={28} />
      </div>
    )
  }
  if (images.length < 4) {
    return (
      <div className={base}>
        <Thumb src={images[0] ?? ''} alt={alt} />
      </div>
    )
  }
  return (
    <div className={`${base} grid grid-cols-2 grid-rows-2`} role="img" aria-label={alt}>
      {images.slice(0, 4).map((src, i) => (
        <Thumb key={`${src}-${i}`} src={src} alt="" />
      ))}
    </div>
  )
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted">
        <MusicIcon size={20} />
      </div>
    )
  }
  // Le thumbnail hqdefault sono 4:3 con bande nere: object-cover le ritaglia.
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
      onError={() => {
        setFailed(true)
      }}
    />
  )
}
