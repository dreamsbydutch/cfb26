import { Link } from '@tanstack/react-router'

type PrimaryDestination = 'roster' | 'games'

const destinations: Array<{
  id: PrimaryDestination
  label: string
  to: '/' | '/games'
}> = [
  { id: 'roster', label: 'Roster', to: '/' },
  { id: 'games', label: 'Games', to: '/games' },
]

export function MobilePrimaryNav({ active }: { active: PrimaryDestination }) {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-michigan-maize bg-michigan-blue pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-8px_24px_rgba(0,39,76,0.2)] sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-2">
        {destinations.map((destination) => {
          const isActive = destination.id === active
          return (
            <Link
              key={destination.id}
              to={destination.to}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-14 touch-manipulation items-center justify-center gap-2 border-x border-white/10 px-4 text-xs font-black uppercase tracking-[0.12em] transition focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-michigan-maize ${
                isActive
                  ? 'bg-michigan-maize text-michigan-blue'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {destination.id === 'roster' ? <RosterIcon /> : <GamesIcon />}
              {destination.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function RosterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current"
      strokeWidth="2"
    >
      <circle cx="9" cy="7" r="3" />
      <path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M16 8h5M16 12h5M17 16h4" />
    </svg>
  )
}

function GamesIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-none stroke-current"
      strokeWidth="2"
    >
      <path d="M5 4h14a2 2 0 0 1 2 2v13H3V6a2 2 0 0 1 2-2ZM3 9h18M8 2v4M16 2v4" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}
