import { useState } from 'react'
import { seasonLabel } from '../../../convex/teamRosterFields'
import {
  scheduleOpponentKey,
  scheduleOpponentOptions,
} from './teamScheduleModel'
import type { ScheduleState } from './teamSeasonModel'
import type { TeamSport } from '../../../convex/teamRosterFields'
import { EmptyState, ErrorState, LoadingState } from '~/components/AppShell'

export function TeamSchedule({
  sport,
  season,
  schedule,
}: {
  sport: TeamSport
  season: number
  schedule: ScheduleState
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#00274c]/20 pb-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="m-0 text-sm font-extrabold text-[#00274c]">
            Schedule &amp; results
          </h2>
          <span className="text-[11px] tabular-nums text-slate-500">
            {opponent ? 'vs opponent ' : ''}
            {record}
          </span>
        </div>
        <label>
          <span className="sr-only">Opponent</span>
          <select
            value={opponent}
            onChange={(event) => setOpponent(event.target.value)}
            className="min-h-8 max-w-44 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
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
        className="overflow-x-auto rounded border border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <table className="w-full min-w-[460px] text-left text-xs tabular-nums">
          <caption className="sr-only">
            Michigan {sport} game history, {seasonLabel(season)}. Scores list
            Michigan first. Expand game details for location, tournament, box
            score and recap.
          </caption>
          <thead className="bg-[#00274c] text-[10px] text-white">
            <tr>
              {['Date', 'Opponent', 'Result / time', 'Details'].map((label) => (
                <th key={label} scope="col" className="px-2 py-1.5">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((game) => (
              <tr
                key={game.sourceGameId}
                className="align-top odd:bg-white even:bg-slate-50"
              >
                <td className="whitespace-nowrap px-2 py-1.5">
                  <time dateTime={game.date} title={game.date}>
                    {dateLabel(game.date)}
                  </time>
                  {game.endDate && game.endDate !== game.date && (
                    <>–{dateLabel(game.endDate)}</>
                  )}
                </td>
                <th
                  scope="row"
                  className="px-2 py-1.5 font-semibold text-[#00274c]"
                >
                  <span className="mr-1 font-normal text-slate-500">
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
                    <span
                      title={game.exhibition ? 'Exhibition' : 'Conference game'}
                      className="ml-1 text-[10px] font-normal text-slate-500"
                    >
                      {game.exhibition ? 'Exh.' : 'Conf.'}
                    </span>
                  )}
                </th>
                <td className="px-2 py-1.5">
                  <span
                    className={`whitespace-nowrap ${game.result === 'W' ? 'font-extrabold text-[#00274c]' : 'font-semibold text-slate-600'}`}
                  >
                    {game.status === 'final'
                      ? game.michiganScore === null
                        ? 'Final · no score'
                        : `${game.result} ${game.michiganScore}–${game.opponentScore}`
                      : game.status === 'scheduled'
                        ? game.time || 'TBA'
                        : game.status === 'no_contest'
                          ? 'No contest'
                          : game.status === 'cancelled'
                            ? 'Cancelled'
                            : 'Postponed'}
                  </span>
                  {game.note && (
                    <span className="ml-1 text-[10px] text-slate-500">
                      {game.note}
                    </span>
                  )}
                </td>
                <td className="px-2">
                  <details className="text-[11px] text-slate-500">
                    <summary
                      aria-label={`Game details: ${game.opponent}, ${game.date}`}
                      className="min-h-8 cursor-pointer content-center py-1.5"
                    >
                      Details
                    </summary>
                    <div className="space-y-1 pb-2">
                      <p className="m-0">
                        {game.location || 'Location unavailable'}
                      </p>
                      {game.tournament && (
                        <p className="m-0">{game.tournament}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[#00274c]">
                        {game.boxScoreUrl && (
                          <a
                            className="inline-flex min-h-8 items-center font-semibold underline underline-offset-2"
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
                            className="inline-flex min-h-8 items-center font-semibold underline underline-offset-2"
                            href={game.recapUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Recap: ${game.opponent}, ${game.date}`}
                          >
                            Recap
                          </a>
                        )}
                      </div>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-1 text-[11px] text-slate-500">
        <summary className="min-h-8 cursor-pointer py-2 font-semibold">
          Schedule notes &amp; source
        </summary>
        <p className="m-0 mb-2">
          Scores list Michigan first; records exclude exhibitions.{' '}
          {sport === 'hockey' &&
            'Shootout outcomes remain in the notes; tied games retain the official tie. '}
          Upcoming games have no score. Times are as listed by Michigan
          Athletics.
        </p>
        {schedule.data.sourceUrl && (
          <p className="m-0 mb-2">
            <a
              className="underline underline-offset-2"
              href={schedule.data.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Michigan Athletics schedule
            </a>
            {schedule.data.importedAt !== null && (
              <>
                {' '}
                · Updated{' '}
                {new Date(schedule.data.importedAt).toLocaleDateString('en-US')}
              </>
            )}
          </p>
        )}
      </details>
    </section>
  )
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
