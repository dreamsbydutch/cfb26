import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { conferenceLogo } from './RatingField'
import { rankingControlClass } from './RankingTable'
import { seasonTiers } from './seasonTiers'
import type { FunctionReturnType } from 'convex/server'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageFrame,
  PageHero,
  PublicShell,
  Surface,
} from '~/components/AppShell'

type Standing = FunctionReturnType<
  typeof api.teamData.listStandingsBySeason
>[number]
type Program = FunctionReturnType<typeof api.teamData.listPrograms>[number]
const currentSeason = new Date().getFullYear()
const record = (row: Standing) => `${row.wins}–${row.losses}`
const conferenceRecord = (row: Standing) =>
  row.conferenceWins === undefined || row.conferenceLosses === undefined
    ? '—'
    : `${row.conferenceWins}–${row.conferenceLosses}`
const conferencePercentage = (row: Standing) =>
  row.conferenceWinPercentage ??
  (row.conferenceWins !== undefined &&
  row.conferenceLosses !== undefined &&
  row.conferenceWins + row.conferenceLosses > 0
    ? row.conferenceWins / (row.conferenceWins + row.conferenceLosses)
    : -1)
const compare = (a: Standing, b: Standing) =>
  conferencePercentage(b) - conferencePercentage(a) ||
  b.winPercentage - a.winPercentage

export function NationalSeason() {
  const [season, setSeason] = useState(() => {
    const value =
      typeof window === 'undefined'
        ? currentSeason
        : Number(
            new URLSearchParams(window.location.search).get('season') ??
              currentSeason,
          )
    return Number.isInteger(value) && value >= 2015 && value <= currentSeason
      ? value
      : currentSeason
  })
  const [selected, setSelected] = useState('')
  const [conference, setConference] = useState('all')
  const standings = useQuery(
    convexQuery(api.teamData.listStandingsBySeason, { season, limit: 500 }),
  )
  const directory = useQuery(
    convexQuery(api.teamData.listPrograms, { limit: 1000 }),
  )
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('season', String(season))
    window.history.replaceState(window.history.state, '', url)
  }, [season])
  const programs = new Map(
    directory.data?.map((program) => [String(program._id), program]),
  )
  const rows = standings.data ?? []
  const tiers = seasonTiers(rows)
  const conferences = [
    ...new Set(
      tiers.flatMap((tier) => tier.columns.map((column) => column.name)),
    ),
  ].sort()
  const team =
    rows.find((row) => String(row.programId) === selected) ??
    rows.find(
      (row) => programs.get(String(row.programId))?.key === 'michigan',
    ) ??
    rows.at(0)
  const ownConference = team?.conference || 'Independent'
  const conferenceRows = rows
    .filter((row) => (row.conference || 'Independent') === ownConference)
    .sort(
      (a, b) =>
        compare(a, b) || a.sourceProgramName.localeCompare(b.sourceProgramName),
    )
  const selectTeam = (row: Standing) => setSelected(String(row.programId))
  const bands = tiers
    .map((tier) => ({
      ...tier,
      columns: tier.columns.filter(
        (column) => conference === 'all' || column.name === conference,
      ),
    }))
    .filter((tier) => tier.columns.length > 0)
  return (
    <PublicShell active="season" context="national">
      <PageFrame>
        <PageHero eyebrow={`${season} · National football`} title="Season" />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <select
            aria-label="Season"
            value={season}
            onChange={(event) => {
              setSeason(Number(event.target.value))
              setConference('all')
            }}
            className={rankingControlClass}
          >
            {Array.from({ length: currentSeason - 2014 }, (_, index) => (
              <option key={index}>{currentSeason - index}</option>
            ))}
          </select>
          <select
            aria-label="Conference"
            value={conference}
            onChange={(event) => setConference(event.target.value)}
            className={rankingControlClass}
          >
            <option value="all">All conferences</option>
            {conferences.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <p className="text-xs text-white/50">
            CFBD season snapshots · Select a team to explore its season
          </p>
        </div>
        {standings.isPending || directory.isPending ? (
          <LoadingState label="Loading season standings" />
        ) : standings.isError || directory.isError ? (
          <ErrorState>
            Season standings could not load. Please try again.
          </ErrorState>
        ) : !rows.length ? (
          <EmptyState>
            No FBS standings have been imported for {season}.
          </EmptyState>
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
            <Surface className="min-w-0 p-4 sm:p-6">
              <h2 className="font-display text-2xl font-extrabold">
                College football at a glance
              </h2>
              <p className="mb-5 mt-2 text-xs text-white/50">
                Overall record · [conference record]. Ordered by conference win
                percentage, then overall win percentage. Equal records are tied;
                alphabetical display order does not resolve official
                tiebreakers. Missing records remain unknown.
              </p>
              {bands.map(({ title, columns: band }) => (
                <section key={title} className="mb-6" aria-label={title}>
                  <h3 className="font-display mb-3 border-t border-white/10 pt-4 text-xl font-extrabold">
                    {title}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <caption className="sr-only">
                        {title} standings for {season}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col" className="p-2">
                            Row
                          </th>
                          {band.map(({ name }) => {
                            const logo = conferenceLogo(name)
                            return (
                              <th
                                key={name}
                                scope="col"
                                className="min-w-28 bg-white/5 p-3 text-center"
                              >
                                {logo && (
                                  <img
                                    src={logo}
                                    alt=""
                                    className="mx-auto mb-2 h-8 w-14 object-contain"
                                  />
                                )}
                                <span>{name}</span>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(
                          {
                            length: Math.max(
                              0,
                              ...band.map((column) => column.rows.length),
                            ),
                          },
                          (_, index) => (
                            <tr
                              key={index}
                              className="border-t border-white/10 even:bg-white/[0.025]"
                            >
                              <th scope="row" className="p-2 text-white/40">
                                {index + 1}
                              </th>
                              {band.map(({ name, rows: teams }) => {
                                const group = [...teams].sort(
                                  (a, b) =>
                                    compare(a, b) ||
                                    a.sourceProgramName.localeCompare(
                                      b.sourceProgramName,
                                    ),
                                )
                                const row = group.at(index)
                                return (
                                  <td key={name} className="p-1 align-top">
                                    {row && (
                                      <button
                                        type="button"
                                        aria-pressed={
                                          row.programId === team?.programId
                                        }
                                        onClick={() => selectTeam(row)}
                                        className={`flex min-h-14 w-full items-center gap-2 rounded-lg p-2 text-left focus-visible:outline-2 ${row.programId === team?.programId ? 'bg-sky-500/15 ring-1 ring-sky-400/50' : 'hover:bg-white/10'}`}
                                      >
                                        <TeamLogo
                                          program={programs.get(
                                            String(row.programId),
                                          )}
                                        />
                                        <span>
                                          <span className="block max-w-28 text-[10px] text-white/60">
                                            {row.sourceProgramName}
                                          </span>
                                          <b>{record(row)}</b>
                                          <span className="block text-[10px] text-white/40">
                                            [{conferenceRecord(row)}]
                                          </span>
                                          {index > 0 &&
                                            compare(group[index - 1], row) ===
                                              0 && (
                                              <span className="text-[9px] text-white/40">
                                                Tied
                                              </span>
                                            )}
                                        </span>
                                      </button>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </Surface>
            <div className="grid min-w-0 gap-6">
              {team && (
                <TeamSchedule
                  key={`${season}:${team.programId}`}
                  program={programs.get(String(team.programId))}
                  season={season}
                />
              )}
              <Surface className="min-w-0 p-4 sm:p-6">
                <p className="app-label">Selected team’s conference</p>
                <h2 className="font-display mb-4 mt-2 text-2xl font-extrabold">
                  {ownConference}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      {ownConference} detailed standings
                    </caption>
                    <thead className="app-label">
                      <tr>
                        {['Team', 'Overall', 'Conf.', 'AP'].map((label) => (
                          <th key={label} scope="col" className="p-2">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {conferenceRows.map((row) => (
                        <tr
                          key={row._id}
                          className={`border-t border-white/10 ${row.programId === team?.programId ? 'bg-sky-500/10' : ''}`}
                        >
                          <th scope="row" className="p-2">
                            <button
                              type="button"
                              onClick={() => selectTeam(row)}
                              className="flex min-h-11 items-center gap-2 text-left focus-visible:outline-2"
                            >
                              <TeamLogo
                                program={programs.get(String(row.programId))}
                              />
                              {row.sourceProgramName}
                            </button>
                          </th>
                          <td className="p-2 tabular-nums">{record(row)}</td>
                          <td className="p-2 tabular-nums">
                            {conferenceRecord(row)}
                          </td>
                          <td className="p-2">
                            {row.apCurrentRank ? `#${row.apCurrentRank}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Surface>
            </div>
          </div>
        )}
      </PageFrame>
    </PublicShell>
  )
}

function TeamLogo({ program }: { program: Program | undefined }) {
  return program?.logos?.[0] ? (
    <img
      src={program.logos[0]}
      alt=""
      loading="lazy"
      className="h-8 w-8 shrink-0 object-contain"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/10 text-xs"
    >
      {program?.abbreviation ?? 'CFB'}
    </span>
  )
}

function TeamSchedule({
  program,
  season,
}: {
  program: Program | undefined
  season: number
}) {
  const result = useQuery(
    convexQuery(api.teamData.getProgramProfile, {
      programKey: program?.key ?? '',
      season,
    }),
  )
  return (
    <Surface className="p-4 sm:p-6">
      <p className="app-label">{season} season</p>
      <h2 className="font-display mb-4 mt-2 flex items-center gap-3 text-2xl font-extrabold">
        <TeamLogo program={program} />
        {program?.name} schedule
      </h2>
      {result.isPending ? (
        <LoadingState label="Loading schedule" />
      ) : result.isError ? (
        <ErrorState>Schedule could not load.</ErrorState>
      ) : !result.data?.games.length ? (
        <EmptyState>No schedule has been imported.</EmptyState>
      ) : (
        <>
          <ol className="divide-y divide-white/10">
            {result.data.games.map((game) => {
              const home = game.homeProgramId === program?._id
              const own = home ? game.homePoints : game.awayPoints
              const opponent = home ? game.awayPoints : game.homePoints
              const scored =
                game.completed && own !== undefined && opponent !== undefined
              return (
                <li
                  key={game._id}
                  className="flex items-center gap-3 py-3 text-sm"
                >
                  <span className="w-9 shrink-0 text-xs text-white/40">
                    {game.seasonType === 'postseason'
                      ? 'Post'
                      : `W${game.week}`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-white/40">
                      {game.neutralSite ? 'vs' : home ? 'vs' : '@'}{' '}
                    </span>
                    {home ? game.awaySourceName : game.homeSourceName}
                  </span>
                  <span
                    className={`shrink-0 rounded px-2 py-1 text-xs font-bold ${scored ? (own > opponent ? 'bg-emerald-500/15 text-emerald-700' : own < opponent ? 'bg-red-500/15 text-red-700' : 'bg-white/10') : 'text-white/50'}`}
                  >
                    {scored
                      ? `${own > opponent ? 'W' : own < opponent ? 'L' : 'T'} ${own}–${opponent}`
                      : game.completed
                        ? 'Final · score unavailable'
                        : new Date(game.startTime).toLocaleDateString()}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="mt-4 text-xs text-white/40">
            Saved schedule and results may update separately from the standings
            snapshot. Missing weeks are not assumed to be byes.
          </p>
        </>
      )}
    </Surface>
  )
}
