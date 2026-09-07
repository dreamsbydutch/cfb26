import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import Fuse from 'fuse.js'
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Command,
  Gamepad2,
  GitCompareArrows,
  LayoutDashboard,
  ListFilter,
  Menu,
  Search,
  ShieldCheck,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type PublicContext = 'michigan' | 'national'

type NavItem = {
  href: string
  icon: LucideIcon
  id: string
  label: string
}

const MICHIGAN_NAV: Array<NavItem> = [
  { href: '/', icon: LayoutDashboard, id: 'matrix', label: 'Matrix' },
  {
    href: '/michigan/overview',
    icon: BarChart3,
    id: 'overview',
    label: 'Overview',
  },
  {
    href: '/michigan/movement',
    icon: ListFilter,
    id: 'movement',
    label: 'Movement',
  },
  {
    href: '/michigan/alumni',
    icon: UsersRound,
    id: 'alumni',
    label: 'Alumni',
  },
  {
    href: '/michigan/compare',
    icon: GitCompareArrows,
    id: 'compare',
    label: 'Compare',
  },
]

const NATIONAL_NAV: Array<NavItem> = [
  { href: '/games', icon: CalendarDays, id: 'games', label: 'Games' },
  { href: '/national/power', icon: BarChart3, id: 'power', label: 'Power' },
  { href: '/national/resume', icon: Trophy, id: 'resume', label: 'Résumé' },
  {
    href: '/national/playoff',
    icon: ShieldCheck,
    id: 'playoff',
    label: 'Playoff',
  },
  { href: '/national/teams', icon: UsersRound, id: 'teams', label: 'Teams' },
  {
    href: '/national/simulator',
    icon: Gamepad2,
    id: 'simulator',
    label: 'Simulator',
  },
  {
    href: '/national/ballot',
    icon: ListFilter,
    id: 'ballot',
    label: 'Blind ballot',
  },
  {
    href: '/national/methodology',
    icon: Command,
    id: 'methodology',
    label: 'Methodology',
  },
]

export function PublicShell({
  active,
  children,
  context,
}: {
  active: string
  children: ReactNode
  context: PublicContext
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const nav = context === 'michigan' ? MICHIGAN_NAV : NATIONAL_NAV
  const mobile = nav.slice(0, 3)

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', openSearch)
    return () => window.removeEventListener('keydown', openSearch)
  }, [])

  return (
    <div
      className={`app-public-shell app-context-${context} min-h-screen pb-20 lg:pb-0`}
    >
      <header className="app-shell-header sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-3"
            aria-label="DbyD CFB home"
          >
            <DbyDMark />
            <span className="hidden sm:block">
              <strong className="font-display block text-xl font-extrabold uppercase leading-none tracking-wide">
                DbyD CFB
              </strong>
              <small className="app-label mt-1 block">
                Football intelligence
              </small>
            </span>
          </Link>
          <nav
            aria-label="Football context"
            className="ml-2 hidden rounded-full bg-white/[0.045] p-1 sm:flex"
          >
            <ShellLink active={context === 'michigan'} href="/">
              Michigan
            </ShellLink>
            <ShellLink active={context === 'national'} href="/games">
              National
            </ShellLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="app-control flex h-10 min-h-10 items-center gap-2 px-3 text-sm text-white/75 transition hover:border-white/35 hover:text-white"
            >
              <Search size={17} aria-hidden="true" />
              <span className="hidden md:inline">Search players & teams</span>
              <kbd className="hidden rounded-md border border-white/15 bg-black/20 px-1.5 py-0.5 text-[10px] text-white/45 lg:inline">
                Ctrl K
              </kbd>
            </button>
            <Link
              to="/admin/roster"
              className="hidden h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-white/55 transition hover:bg-white/5 hover:text-white md:flex"
            >
              <CircleUserRound size={17} aria-hidden="true" /> Owner
            </Link>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 lg:hidden"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        <div className="hidden border-t border-white/[0.06] lg:block">
          <nav
            aria-label={`${context} navigation`}
            className="scrollbar-none mx-auto flex max-w-[1680px] gap-1 overflow-x-auto px-8 py-2"
          >
            {nav.map((item) => (
              <ContextLink
                key={item.id}
                item={item}
                active={active === item.id}
              />
            ))}
          </nav>
        </div>
        {menuOpen && (
          <nav
            aria-label={`${context} navigation`}
            className="app-shell-menu grid gap-1 border-t border-white/10 p-3 lg:hidden"
          >
            <div className="mb-2 flex gap-1 rounded-full bg-white/[0.045] p-1 sm:hidden">
              <ShellLink active={context === 'michigan'} href="/">
                Michigan
              </ShellLink>
              <ShellLink active={context === 'national'} href="/games">
                National
              </ShellLink>
            </div>
            {nav.map((item) => (
              <ContextLink
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => setMenuOpen(false)}
              />
            ))}
          </nav>
        )}
      </header>
      {children}
      <nav
        aria-label="Mobile primary navigation"
        className="app-shell-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {mobile.map((item) => (
          <MobileLink key={item.id} item={item} active={active === item.id} />
        ))}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/55"
        >
          <Menu size={19} aria-hidden="true" /> More
        </button>
      </nav>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

function ShellLink({
  active,
  children,
  href,
}: {
  active: boolean
  children: ReactNode
  href: string
}) {
  return (
    <Link
      to={href}
      className={`rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] transition ${active ? 'app-shell-switch-active' : 'text-white/55 hover:text-white'}`}
    >
      {children}
    </Link>
  )
}

function ContextLink({
  active,
  item,
  onClick,
}: {
  active: boolean
  item: NavItem
  onClick?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      to={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold transition ${active ? 'app-shell-nav-active bg-white/10' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}
    >
      <Icon size={16} aria-hidden="true" /> {item.label}
    </Link>
  )
}

function MobileLink({ active, item }: { active: boolean; item: NavItem }) {
  const Icon = item.icon
  return (
    <Link
      to={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider ${active ? 'app-shell-nav-active' : 'text-white/55'}`}
    >
      <Icon size={19} aria-hidden="true" /> {item.label}
    </Link>
  )
}

export function PageFrame({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main
      className={`mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9 ${className}`}
    >
      {children}
    </main>
  )
}

export function PageHero({
  eyebrow,
  title,
  summary,
  actions,
}: {
  actions?: ReactNode
  eyebrow: string
  summary?: string
  title: string
}) {
  return (
    <header className="mb-7 grid gap-5 border-b border-white/10 pb-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,34rem)] lg:items-end">
      <div>
        <p className="app-kicker mb-3">{eyebrow}</p>
        <h1 className="app-title text-balance">{title}</h1>
      </div>
      <div className="lg:text-right">
        {summary && (
          <p className="m-0 text-sm leading-6 text-white/55">{summary}</p>
        )}
        {actions && (
          <div className="mt-4 flex flex-wrap justify-start gap-2 lg:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}

export function Surface({
  children,
  className = '',
  as: Element = 'section',
}: {
  as?: 'article' | 'aside' | 'section'
  children: ReactNode
  className?: string
}) {
  return <Element className={`app-card ${className}`}>{children}</Element>
}

export function Metric({
  label,
  value,
  note,
}: {
  label: string
  note?: string
  value: ReactNode
}) {
  return (
    <div className="app-card min-w-0 p-4">
      <div className="app-label">{label}</div>
      <div className="font-display mt-1 text-3xl font-extrabold tabular-nums text-white">
        {value}
      </div>
      {note && (
        <div className="mt-1 truncate text-xs text-white/40">{note}</div>
      )}
    </div>
  )
}

export function EmptyState({
  children,
  title = 'Nothing to show',
}: {
  children: ReactNode
  title?: string
}) {
  return (
    <div className="app-card border-dashed p-8 text-center">
      <h2 className="m-0 text-2xl font-bold">{title}</h2>
      <div className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/50">
        {children}
      </div>
    </div>
  )
}

export function LoadingState({
  label = 'Loading intelligence',
}: {
  label?: string
}) {
  return (
    <div className="app-card animate-pulse p-8" aria-live="polite">
      <div className="h-3 w-28 rounded-full bg-white/10" />
      <div className="mt-4 h-10 max-w-xl rounded-xl bg-white/10" />
      <div className="mt-3 h-24 rounded-xl bg-white/5" />
      <p className="mt-4 text-sm text-white/45">{label}…</p>
    </div>
  )
}

export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <div className="app-card border-red-400/25 p-8">
      <p className="app-kicker text-red-300">Connection exception</p>
      <h2 className="mt-2 text-3xl font-bold">
        This view could not be loaded.
      </h2>
      <p className="mt-2 text-sm text-white/50">{children}</p>
    </div>
  )
}

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'danger' | 'maize' | 'neutral' | 'success'
}) {
  const tones = {
    danger: 'border-red-300/25 bg-red-400/10 text-red-200',
    maize: 'border-[#ffcb05]/25 bg-[#ffcb05]/10 text-[#ffe16a]',
    neutral: 'border-white/10 bg-white/5 text-white/60',
    success: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
  }
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function ContextBar({ children }: { children: ReactNode }) {
  return (
    <div className="app-card sticky top-[4.5rem] z-20 mb-6 flex flex-wrap items-center gap-3 p-3 backdrop-blur-xl lg:top-[7.5rem]">
      {children}
    </div>
  )
}

function DbyDMark() {
  return (
    <span
      className="app-mark grid h-10 w-10 place-items-center rounded-xl border font-display text-[10px] font-extrabold tracking-[-0.04em]"
      aria-hidden="true"
    >
      DxDCFB
    </span>
  )
}

type SearchEntry = {
  aliases: Array<string>
  href: string
  id: string
  kind: 'Player' | 'Program'
  label: string
  meta: string
  isMichigan: boolean
}

function GlobalSearch({
  open,
  onClose,
}: {
  onClose: () => void
  open: boolean
}) {
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLElement>(null)
  const catalog = useQuery({
    ...convexQuery(api.players.searchCatalog, {}),
    enabled: open,
  })
  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 10)
    else setQuery('')
  }, [open])
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const focusable = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input',
        ) ?? []),
      ]
      const first = focusable.at(0)
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, open])
  const entries = useMemo<Array<SearchEntry>>(
    () => [
      ...(catalog.data?.players ?? []).map((row) => ({
        ...row,
        href: `/michigan/players/${row.id}`,
        id: String(row.id),
        isMichigan: false,
        kind: 'Player' as const,
      })),
      ...(catalog.data?.programs ?? []).map((row) => ({
        ...row,
        href: `/national/teams/${row.key}`,
        id: String(row.id),
        isMichigan: row.key === 'michigan',
        kind: 'Program' as const,
      })),
    ],
    [catalog.data],
  )
  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        includeScore: true,
        keys: [
          { name: 'label', weight: 0.7 },
          { name: 'aliases', weight: 0.3 },
        ],
        threshold: 0.36,
      }),
    [entries],
  )
  const results =
    query.trim().length < 2
      ? []
      : fuse.search(query.trim(), { limit: 12 }).map((result) => result.item)
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 p-3 backdrop-blur-sm sm:p-10"
      role="dialog"
      aria-modal="true"
      aria-label="Search players and teams"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <section
        ref={dialog}
        className="app-search-panel mx-auto max-w-2xl overflow-hidden rounded-3xl border border-white/15 shadow-2xl"
      >
        <label className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search size={21} className="app-accent-text" aria-hidden="true" />
          <span className="sr-only">Search players and teams</span>
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try a player, team, or alias"
            className="h-16 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/30"
          />
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-white/50 hover:bg-white/5 hover:text-white"
            aria-label="Close search"
          >
            <X size={19} />
          </button>
        </label>
        <div className="max-h-[65vh] overflow-y-auto p-2">
          {catalog.isLoading ? (
            <p className="p-5 text-sm text-white/45">Loading search index…</p>
          ) : query.trim().length < 2 ? (
            <p className="p-5 text-sm text-white/45">
              Enter at least two characters. Typo-tolerant matching includes
              known program aliases.
            </p>
          ) : results.length === 0 ? (
            <p className="p-5 text-sm text-white/45">
              No matching players or programs.
            </p>
          ) : (
            results.map((entry) => (
              <Link
                key={`${entry.kind}:${entry.id}`}
                to={entry.href}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-2xl p-3 transition hover:bg-white/[0.06] ${entry.isMichigan ? 'michigan-highlight' : ''}`}
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl bg-white/5 ${entry.isMichigan ? 'michigan-accent' : 'app-accent-text'}`}
                >
                  {entry.kind === 'Player' ? (
                    <CircleUserRound size={19} />
                  ) : (
                    <ShieldCheck size={19} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{entry.label}</b>
                  <small className="block truncate text-white/40">
                    {entry.kind} · {entry.meta}
                  </small>
                </span>
                <ChevronRight
                  size={18}
                  className="text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/70"
                />
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
