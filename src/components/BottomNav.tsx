import { NavLink } from 'react-router'
import type { ComponentType } from 'react'
import { HomeIcon, LibraryIcon, SearchIcon } from './icons'
import { t } from '../i18n'

interface NavItem {
  to: string
  label: string
  Icon: ComponentType<{ filled?: boolean; className?: string }>
}

const items: readonly NavItem[] = [
  { to: '/', label: t.nav.home, Icon: HomeIcon },
  { to: '/search', label: t.nav.search, Icon: SearchIcon },
  { to: '/library', label: t.nav.library, Icon: LibraryIcon },
]

export function BottomNav() {
  return (
    <nav
      aria-label={t.nav.ariaLabel}
      className="pb-safe border-t border-border/60 bg-gradient-to-t from-bg via-bg/95 to-bg/80 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl">
        {items.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-text' : 'text-muted hover:text-text',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon filled={isActive} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
