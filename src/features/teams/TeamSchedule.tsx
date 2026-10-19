import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { seasonLabel } from '../../../convex/teamRosterFields'
import {
  scheduleOpponentKey,
  scheduleOpponentOptions,
} from './teamScheduleModel'
import type { Infer } from 'convex/values'
import type { teamGame } from '../../../convex/teamScheduleFields'
import type { TeamSport } from '../../../convex/teamRosterFields'
import { EmptyState, ErrorState, LoadingState } from '~/components/AppShell'

export function TeamSchedule({
  sport,
  season,
}: {
  sport: TeamSport
  season: number
}) {
  return sport === 'hockey' ? (
    <HockeySchedule season={season} />
  ) : (
    <BasketballSchedule season={season} />
  )
}
function HockeySchedule({ season }: { season: number }) {
  const schedule = useQuery(convexQuery(api.hockeySchedules.list, { season }))
  return <ScheduleView sport="hockey" season={season} schedule={schedule} />
}
function BasketballSchedule({ season }: { season: number }) {
  const schedule = useQuery(
    convexQuery(api.basketballSchedules.list, { season }),
  )
  return <ScheduleView sport="basketball" season={season} schedule={schedule} />
}
function ScheduleView({
  sport,
  season,
  schedule,
}: {
  sport: TeamSport
  season: number
  schedule: {
    isPending: boolean
    isError: boolean
    data?: {
      games: Array<Infer<typeof teamGame>>
      sourceUrl: string | null
      importedAt: number | null
    }
  }
}) {
  const [opponent, setOpponent] = useState('')
  if (schedule.isPending)
    return <LoadingState label={`Loading ${sport} schedule`} />
  if (schedule.isError || !schedule.data)
    return (
      <ErrorState>
        Could not load this schedule. Reload to try again.
      </ErrorState>
    )
  if (!schedule.data.games.length)
    return (
      <EmptyState title="No schedule available">
        The {seasonLabel(season)} schedule has not been imported yet.
      </EmptyState>
    )
  const games = schedule.data.games
  const opponents = scheduleOpponentOptions(games)
  const rows = games.filter(
    (game) => !opponent || scheduleOpponentKey(game) === opponent,
  )
  const counted = rows.filter(
    (game) => !game.exhibition && game.status === 'final' && game.result,
  )
  const record = (sport === 'hockey' ? ['W', 'L', 'T'] : ['W', 'L'])
    .map((result) => counted.filter((game) => game.result === result).length)
    .join('–')
  return (
    <section aria-label={`${seasonLabel(season)} ${sport} schedule`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Schedule &amp; results</h2>
          <p className="app-muted mt-1 text-sm">
            {opponent ? 'Selected opponent' : 'Season'} record:{' '}
            <strong>{record}</strong> · {sport === 'hockey' ? 'W–L–T' : 'W–L'} ·
            Exhibitions excluded
          </p>
        </div>
        <label className="text-xs font-bold">
          Opponent
          <select
            value={opponent}
            onChange={(event) => setOpponent(event.target.value)}
            className="app-control ml-2 max-w-full px-3 py-2"
          >
            <option value="">All opponents</option>
            {opponents.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        role="region"
        aria-label={`${sport} games`}
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <table className="w-full min-w-[680px] text-left text-sm">
          <caption className="sr-only">
            Michigan {sport} game history, {seasonLabel(season)}. Scores list
            Michigan first.
          </caption>
          <thead className="bg-[#00274c] text-white">
            <tr>
              {['Date', 'Opponent', 'Result / time', 'Location', 'Details'].map(
                (label) => (
                  <th key={label} scope="col" className="px-4 py-3">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((game) => (
              <tr key={game.sourceGameId} className="align-top">
                <td className="whitespace-nowrap px-4 py-3">
                  <time dateTime={game.date}>{dateLabel(game.date)}</time>
                  {game.endDate && game.endDate !== game.date && (
                    <> – {dateLabel(game.endDate)}</>
                  )}
                </td>
                <th scope="row" className="px-4 py-3 font-semibold">
                  <span className="mr-2 font-normal text-slate-500">
                    {game.venue === 'away'
                      ? 'at'
                      : game.venue === 'neutral'
                        ? 'vs (N)'
                        : game.venue === 'home'
                          ? 'vs'
                          : ''}
                  </span>
                  {game.opponentPrefix && `${game.opponentPrefix} `}
                  {game.opponent}
                  {(game.exhibition || game.conference) && (
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      {game.exhibition ? 'Exhibition' : 'Conference'}
                    </span>
                  )}
                </th>
                <td className="px-4 py-3">
                  <span className="whitespace-nowrap font-bold">
                    {game.status === 'final'
                      ? game.michiganScore === null
                        ? 'Final · score unavailable'
                        : `${game.result} ${game.michiganScore}–${game.opponentScore}`
                      : game.status === 'scheduled'
                        ? game.time
                        : game.status === 'no_contest'
                          ? 'No contest'
                          : game.status === 'cancelled'
                            ? 'Cancelled'
                            : 'Postponed'}
                  </span>
                  {game.note && (
                    <span className="mt-1 block text-xs text-slate-500">
                      {game.note}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {game.location || '—'}
                  {game.tournament && (
                    <span className="mt-1 block text-xs">
                      {game.tournament}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {game.boxScoreUrl && (
                      <a
                        className="font-semibold underline underline-offset-2"
                        href={game.boxScoreUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Box score: ${game.opponent}, ${game.date}`}
                      >
                        Box score
                      </a>
                    )}
                    {game.recapUrl && (
                      <a
                        className="font-semibold underline underline-offset-2"
                        href={game.recapUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Recap: ${game.opponent}, ${game.date}`}
                      >
                        Recap
                      </a>
                    )}
                    {!game.boxScoreUrl && !game.recapUrl && '—'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Scores list Michigan first.{' '}
        {sport === 'hockey' &&
          'Shootout outcomes remain in the game notes; tied games retain the official tie. '}
        Upcoming games have no score. Times are as listed by Michigan Athletics.
      </p>
      {schedule.data.sourceUrl && (
        <p className="mt-2 text-xs text-slate-500">
          <a
            className="underline underline-offset-2"
            href={schedule.data.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Michigan Athletics schedule
          </a>{' '}
          · Updated{' '}
          {new Date(schedule.data.importedAt ?? 0).toLocaleDateString('en-US')}
        </p>
      )}
    </section>
  )
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
