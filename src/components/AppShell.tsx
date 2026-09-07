import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

type Area = 'admin' | 'michigan' | 'national'

const links = [
  { area: 'michigan' as const, label: 'Michigan', to: '/' as const },
  { area: 'national' as const, label: 'National', to: '/games' as const },
  { area: 'admin' as const, label: 'Owner', to: '/admin/roster' as const },
]

export function AppShell({
  active,
  children,
  eyebrow,
  title,
}: {
  active: Area
  children: ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <div className="min-h-screen bg-[#f4f1e8] pb-20 text-slate-950 sm:pb-0">
      <header className="border-b border-white/10 bg-[#061b30] text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-6 px-4 py-4 sm:px-8">
          <Link
            to="/"
            className="group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffcb05]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-sm bg-[#ffcb05] font-serif text-2xl font-black text-[#00274c] shadow-[4px_4px_0_#35608a]">
              M
            </span>
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.28em] text-[#ffcb05]">
                College football intelligence
              </span>
              <span className="font-serif text-xl font-black tracking-tight">
                CFB26
              </span>
            </span>
          </Link>
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 sm:flex"
          >
            {links.map((link) => (
              <Link
                key={link.area}
                to={link.to}
                aria-current={active === link.area ? 'page' : undefined}
                className={`rounded-sm px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition focus-visible:outline-2 focus-visible:outline-[#ffcb05] ${
                  active === link.area
                    ? 'bg-[#ffcb05] text-[#00274c]'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mx-auto max-w-[1500px] px-4 pb-8 pt-10 sm:px-8 sm:pb-12 sm:pt-16">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#ffcb05]">
            {eyebrow}
          </p>
          <h1 className="max-w-5xl font-serif text-4xl font-black leading-[0.95] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            {title}
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 sm:py-9">
        {children}
      </main>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t-2 border-[#ffcb05] bg-[#061b30] pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {links.map((link) => (
          <Link
            key={link.area}
            to={link.to}
            aria-current={active === link.area ? 'page' : undefined}
            className={`grid min-h-16 place-items-center text-[10px] font-black uppercase tracking-[0.14em] focus-visible:outline-2 focus-visible:outline-[#ffcb05] ${
              active === link.area
                ? 'bg-[#ffcb05] text-[#00274c]'
                : 'text-white/70'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function SectionTabs<T extends string>({
  active,
  onChange,
  tabs,
}: {
  active: T
  onChange: (tab: T) => void
  tabs: ReadonlyArray<{ id: T; label: string }>
}) {
  return (
    <div className="scrollbar-none -mx-4 mb-6 flex overflow-x-auto border-y border-slate-300 bg-white px-4 sm:mx-0 sm:rounded-sm sm:border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`min-h-12 shrink-0 border-b-4 px-4 text-xs font-black uppercase tracking-[0.12em] focus-visible:outline-2 focus-visible:outline-[#00274c] ${
            active === tab.id
              ? 'border-[#ffcb05] text-[#00274c]'
              : 'border-transparent text-slate-500 hover:text-slate-950'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-l-4 border-[#ffcb05] bg-white px-4 py-3 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-[#00274c]">{value}</div>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-sm border border-dashed border-slate-400 bg-white/50 p-8 text-center text-sm text-slate-600">
      {children}
    </div>
  )
}
