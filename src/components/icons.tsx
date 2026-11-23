import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { filled?: boolean; size?: number }

function Svg({ filled: _filled, size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable={false} {...props}>
      {children}
    </svg>
  )
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      {props.filled ? (
        <path fill="currentColor" d="M12 3.2 2.5 11h2.7v9.3h5.3v-6h3v6h5.3V11h2.7z" />
      ) : (
        <path {...stroke} d="M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-6h3v6H18V9.5" />
      )}
    </Svg>
  )
}

export function SearchIcon(props: IconProps) {
  const w = props.filled ? 3 : 2
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" {...stroke} strokeWidth={w} />
      <path d="m15.5 15.5 5 5" {...stroke} strokeWidth={w} />
    </Svg>
  )
}

export function LibraryIcon(props: IconProps) {
  const w = props.filled ? 2.8 : 2
  return (
    <Svg {...props}>
      <path d="M5 3.5v17M10 3.5v17m4.5-15.5 5 15.5" {...stroke} strokeWidth={w} />
    </Svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path fill="currentColor" d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z" />
    </Svg>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="4" width="4.2" height="16" rx="1.2" fill="currentColor" />
      <rect x="13.8" y="4" width="4.2" height="16" rx="1.2" fill="currentColor" />
    </Svg>
  )
}

export function NextIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path fill="currentColor" d="M5 5.6v12.8a.9.9 0 0 0 1.4.75l9.3-6.4a.9.9 0 0 0 0-1.5L6.4 4.85A.9.9 0 0 0 5 5.6z" />
      <rect x="17" y="4.5" width="2.6" height="15" rx="1" fill="currentColor" />
    </Svg>
  )
}

export function PrevIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path fill="currentColor" d="M19 5.6v12.8a.9.9 0 0 1-1.4.75l-9.3-6.4a.9.9 0 0 1 0-1.5l9.3-6.4A.9.9 0 0 1 19 5.6z" />
      <rect x="4.4" y="4.5" width="2.6" height="15" rx="1" fill="currentColor" />
    </Svg>
  )
}

export function ShuffleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5" />
    </Svg>
  )
}

export function RepeatIcon(props: IconProps & { one?: boolean }) {
  const { one, ...rest } = props
  return (
    <Svg {...rest}>
      <path {...stroke} d="M17 2l3 3-3 3M3 11V9a4 4 0 0 1 4-4h13M7 22l-3-3 3-3M21 13v2a4 4 0 0 1-4 4H4" />
      {one && <text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor">1</text>}
    </Svg>
  )
}

export function HeartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        fill={props.filled ? 'currentColor' : 'none'}
        d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.8 4.5 7.2 4.5c2 0 3.6 1.2 4.8 2.9 1.2-1.7 2.8-2.9 4.8-2.9 3.4 0 5.5 3.4 4.4 6.6C19.5 15.9 12 20.5 12 20.5z"
      />
    </Svg>
  )
}

export function MoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </Svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="m6 9 6 6 6-6" />
    </Svg>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="m15 6-6 6 6 6" />
    </Svg>
  )
}

export function QueueIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M4 6h16M4 12h10M4 18h7M17 14v7l4-3.5z" />
    </Svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M6 6l12 12M18 6 6 18" />
    </Svg>
  )
}

export function ShareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </Svg>
  )
}

export function VolumeIcon(props: IconProps & { muted?: boolean }) {
  const { muted, ...rest } = props
  return (
    <Svg {...rest}>
      <path fill="currentColor" d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" />
      {muted ? (
        <path {...stroke} d="m16 9.5 5 5m0-5-5 5" />
      ) : (
        <path {...stroke} d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
      )}
    </Svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path {...stroke} d="M12 7v5l3 2" />
    </Svg>
  )
}

export function MusicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" {...stroke} />
      <circle cx="17" cy="16" r="3" {...stroke} />
    </Svg>
  )
}

export function MinimizeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M5 12h14" />
    </Svg>
  )
}

export function EditIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
    </Svg>
  )
}

export function ExternalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
    </Svg>
  )
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  )
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M12 5v14M6 13l6 6 6-6" />
    </Svg>
  )
}

export function GlobeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path {...stroke} d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </Svg>
  )
}

export function SchoolIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6" />
    </Svg>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" {...stroke} />
      <path
        {...stroke}
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
      />
    </Svg>
  )
}

export function GripIcon(props: IconProps) {
  return (
    <Svg {...props}>
      {[8, 16].map((x) => [8, 12, 16].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />))}
    </Svg>
  )
}

/** Piccolo equalizzatore animato per il brano in riproduzione. */
export function EqualizerIcon({ playing, size = 16 }: { playing: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="text-accent">
      {[2, 7, 12].map((x, i) => (
        <rect
          key={x}
          x={x}
          y="3"
          width="3"
          height="12"
          rx="1"
          fill="currentColor"
          className={playing ? 'origin-bottom animate-eq' : ''}
          style={{ animationDelay: `${i * 0.18}s`, transformBox: 'fill-box', transform: playing ? undefined : 'scaleY(0.4)' }}
        />
      ))}
    </svg>
  )
}
