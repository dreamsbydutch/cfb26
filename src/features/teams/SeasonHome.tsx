import { getSeasonCoach, getSeasonHistory } from './seasonHistory'
import { metricValues } from './teamRosterModel'
import {
  seasonContributors,
  seasonHonors,
  seasonLeaders,
  seasonResults,
} from './teamSeasonModel'
import { TeamSchedule } from './TeamSchedule'
import type { TeamSport } from '../../../convex/teamRosterFields'
import type {
  RosterState,
  ScheduleState,
  SeasonPlayer,
} from './teamSeasonModel'
import { ErrorState, LoadingState } from '~/components/AppShell'

export function SeasonHome({
  sport,
  season,
  roster,
  schedule,
  onRoster,
}: {
  sport: TeamSport
  season: number
  roster: RosterState
  schedule: ScheduleState
  onRoster: () => void
}) {
  const history = getSeasonHistory(sport, season)
  const coach = getSeasonCoach(sport, season)
  const results = schedule.data?.games.length
    ? seasonResults(sport, schedule.data.games)
    : null
  const contributors = seasonContributors(sport, roster.data?.entries ?? [])
  const skaters = contributors.filter((entry) => entry.values.position !== 'G')
  const goalies =
    sport === 'hockey'
      ? contributors.filter((entry) => entry.values.position === 'G')
      : []
  const honors = seasonHonors(history)
  const leaderFields =
    sport === 'basketball'
      ? [
          { label: 'Points', keys: ['points'] },
          { label: 'Rebounds', keys: ['rebounds'] },
          { label: 'Assists', keys: ['assists'] },
        ]
      : [
          { label: 'Points', keys: ['goals', 'assists'] },
          { label: 'Goals', keys: ['goals'] },
          { label: 'Assists', keys: ['assists'] },
        ]
  const postseason = history
    ? (history.postseason ?? 'No national postseason appearance')
    : schedule.isPending
      ? 'Loading season'
      : schedule.isError
        ? 'Unavailable'
        : schedule.data?.games.length
          ? 'Postseason not yet decided'
          : 'Not recorded'
  return (
    <div className="space-y-3">
      <section
        aria-label="Season summary"
        className="border-y border-[#00274c]/20 py-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <div>
              <span className="sr-only">
                {history ? 'Final record' : 'Season record'}:{' '}
              </span>
              <strong className="text-2xl font-extrabold tabular-nums text-[#00274c]">
                {history?.overall ?? results?.record ?? '\u2014'}
              </strong>
            </div>
            <p className="m-0 text-xs text-slate-600">
              <strong className="tabular-nums text-[#00274c]">
                {history?.conferenceRecord ?? results?.conference ?? '\u2014'}
              </strong>{' '}
              {history?.conference ?? 'Conference'}
              {history ? ` \u00b7 ${placeLabel(history.conferenceFinish)}` : ''}
            </p>
            <p className="m-0 text-xs text-slate-600">
              <span className="text-slate-500">Coach </span>
              {coach?.name ?? '\u2014'}
            </p>
          </div>
          <p className="m-0 text-sm font-bold text-[#00274c]">{postseason}</p>
        </div>
        {!!honors.length && (
          <ul
            aria-label="Season accomplishments"
            className="m-0 mt-1.5 flex list-none flex-wrap gap-1.5 p-0"
          >
            {honors.map((honor) => (
              <li
                key={honor}
                className="rounded border border-[#d5ad00]/50 bg-[#ffcb05]/15 px-2 py-0.5 text-[11px] font-bold text-[#00274c]"
              >
                {honor}
              </li>
            ))}
          </ul>
        )}
        {results && (
          <dl className="mb-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-1.5 text-[11px]">
            {[
              ['Home', results.home],
              ['Away', results.away],
              ['Neutral', results.neutral],
              [
                sport === 'hockey' ? 'GF/G' : 'PPG',
                results.scoringFor?.toFixed(sport === 'hockey' ? 2 : 1) ??
                  '\u2014',
              ],
              [
                sport === 'hockey' ? 'GA/G' : 'Opp PPG',
                results.scoringAgainst?.toFixed(sport === 'hockey' ? 2 : 1) ??
                  '\u2014',
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-1">
                <dt className="text-slate-500">{label}</dt>
                <dd className="m-0 font-semibold tabular-nums text-[#00274c]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <nav
        aria-label="Season sections"
        className="flex flex-wrap gap-x-4 text-xs font-semibold text-[#00274c]"
      >
        <a
          className="inline-flex min-h-8 items-center hover:underline"
          href="#season-contributors"
        >
          Players
        </a>
        <a
          className="inline-flex min-h-8 items-center hover:underline"
          href="#season-postseason"
        >
          Postseason
        </a>
        <a
          className="inline-flex min-h-8 items-center hover:underline"
          href="#season-schedule"
        >
          Schedule &amp; results
        </a>
      </nav>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-3">
          <section
            id="season-contributors"
            className="scroll-mt-24 space-y-2 lg:scroll-mt-36"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#00274c]/20">
              <h2 className="m-0 text-sm font-extrabold text-[#00274c]">
                Contributors{' '}
                <span className="ml-1 text-xs font-normal text-slate-500">
                  {contributors.length || ''}
                </span>
              </h2>
              <button
                className="min-h-8 text-xs font-semibold text-[#00274c] hover:underline"
                onClick={onRoster}
                type="button"
              >
                Full roster &amp; stats
              </button>
            </div>
            {roster.isPending ? (
              <LoadingState label="Loading player contributions" />
            ) : roster.isError ? (
              <ErrorState>
                Could not load player contributions. The schedule is still
                available.
              </ErrorState>
            ) : !contributors.length ? (
              <p className="rounded border border-dashed border-slate-300 px-2 py-1.5 text-xs text-slate-500">
                No player appearances recorded. View the full roster for this
                season's players.
              </p>
            ) : (
              <>
                <dl className="m-0 grid grid-cols-3 divide-x divide-slate-200 bg-slate-50 text-[11px]">
                  {leaderFields.map(({ label, keys }) => {
                    const leader = seasonLeaders(
                      sport === 'hockey' ? skaters : contributors,
                      keys,
                    )
                    return (
                      <div key={label} className="min-w-0 px-2 py-1.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {label} leader
                          {leader && leader.names.length > 1 ? 's' : ''}
                        </dt>
                        <dd className="m-0 mt-0.5 leading-snug text-[#00274c]">
                          {leader?.names.join(' / ') ?? '\u2014'}
                          {leader && (
                            <strong className="ml-1 tabular-nums">
                              {leader.total}
                            </strong>
                          )}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
                {sport === 'basketball' ? (
                  <ContributionTable
                    sport={sport}
                    rows={contributors}
                    goalie={false}
                  />
                ) : (
                  <>
                    {!!skaters.length && (
                      <ContributionTable
                        sport={sport}
                        rows={skaters}
                        goalie={false}
                      />
                    )}
                    {!!goalies.length && (
                      <ContributionTable sport={sport} rows={goalies} goalie />
                    )}
                  </>
                )}
              </>
            )}
          </section>
          <section
            id="season-postseason"
            className="scroll-mt-24 space-y-1 lg:scroll-mt-36"
          >
            <h2 className="m-0 border-b border-[#00274c]/20 py-1 text-sm font-extrabold text-[#00274c]">
              Postseason
            </h2>
            {history && (
              <p className="m-0 py-1 text-xs text-slate-600">
                {history.conference} tournament:{' '}
                <strong>
                  {history.tournamentFinish
                    ? placeLabel(history.tournamentFinish)
                    : 'Cancelled'}
                </strong>
                .
              </p>
            )}
            {history?.note && (
              <p className="m-0 text-xs leading-relaxed text-slate-600">
                {history.note}
              </p>
            )}
            {!!results?.postseason.length && (
              <details className="border-b border-slate-200 text-xs">
                <summary className="min-h-8 cursor-pointer py-2 font-semibold text-[#00274c]">
                  Postseason game log{' '}
                  <span className="font-normal text-slate-500">
                    ({results.postseason.length})
                  </span>
                </summary>
                <ol className="m-0 list-none divide-y divide-slate-200 p-0">
                  {results.postseason.map((game) => (
                    <li
                      key={game.sourceGameId}
                      className="flex items-center justify-between gap-3 py-1.5"
                    >
                      <div className="min-w-0">
                        <span className="mr-2 text-[11px] text-slate-500">
                          <time dateTime={game.date}>
                            {new Date(
                              `${game.date}T12:00:00Z`,
                            ).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'UTC',
                            })}
                          </time>
                        </span>
                        <strong className="text-[#00274c]">
                          {game.opponent}
                        </strong>
                        <span className="block text-[10px] text-slate-500">
                          {game.tournament || 'Postseason'}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <strong className="tabular-nums">
                          {game.status === 'final' && game.result
                            ? `${game.result} ${game.michiganScore}\u2013${game.opponentScore}`
                            : game.status.replaceAll('_', ' ')}
                        </strong>
                        {game.recapUrl && (
                          <a
                            className="ml-2 inline-flex min-h-8 items-center text-[11px] text-slate-500 hover:underline"
                            href={game.recapUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Recap
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </section>
          <details className="text-[11px] text-slate-500">
            <summary className="min-h-8 cursor-pointer py-2 font-semibold">
              Season notes
            </summary>
            <div className="space-y-2 pb-2">
              <p className="m-0">
                Contributors have recorded appearances. A dash means unknown;
                zero remains zero.{' '}
                {sport === 'basketball'
                  ? 'Players are ordered by total minutes; MPG, PPG, RPG and APG are per game.'
                  : 'Skaters are ordered by points and goalies by minutes. SV% and GAA use recorded goaltending totals.'}{' '}
                Leaders use season totals.
              </p>
              {results && (
                <p className="m-0">
                  Records exclude exhibitions. Scoring averages cover{' '}
                  {results.scoredGames} games with recorded scores.
                  {sport === 'hockey'
                    ? ' Shootout games retain the official tie.'
                    : ''}
                </p>
              )}
            </div>
          </details>
        </div>
        <div
          id="season-schedule"
          className="min-w-0 scroll-mt-24 lg:scroll-mt-36"
        >
          <TeamSchedule sport={sport} season={season} schedule={schedule} />
        </div>
      </div>
    </div>
  )
}

function ContributionTable({
  sport,
  rows,
  goalie,
}: {
  sport: TeamSport
  rows: Array<SeasonPlayer>
  goalie: boolean
}) {
  const metrics =
    sport === 'basketball'
      ? ['MPG', 'PPG', 'RPG', 'APG', 'FG%', '3P%', 'FT%']
      : goalie
        ? ['W', 'SV%', 'GAA', 'SO']
        : ['G', 'A', 'PTS', 'SOG', 'PIM']
  const title =
    sport === 'basketball'
      ? 'Basketball contributors'
      : goalie
        ? 'Goaltending'
        : 'Skater contributions'
  return (
    <div
      role="region"
      aria-label={title}
      tabIndex={0}
      className="overflow-x-auto rounded border border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <table className="w-full whitespace-nowrap text-left text-xs tabular-nums">
        <caption className="bg-slate-100 px-2 py-1 text-left text-[11px] font-bold text-[#00274c]">
          {title}
        </caption>
        <thead className="bg-[#00274c] text-[10px] text-[#ffffff]">
          <tr>
            {[
              'Player',
              'Pos',
              'GP',
              ...(goalie ? ['MIN'] : []),
              ...metrics,
            ].map((label) => (
              <th
                key={label}
                scope="col"
                className={`px-2 py-1 ${label === 'Player' ? 'sticky left-0 z-10 bg-[#00274c]' : ''}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map(({ _id, values }) => (
            <tr key={_id} className="odd:bg-white even:bg-slate-50">
              <th
                scope="row"
                className="sticky left-0 z-10 min-w-28 max-w-40 whitespace-normal bg-inherit px-2 py-1.5 font-semibold text-[#00274c]"
              >
                {values.name}
              </th>
              <td className="px-2 py-1.5">{values.position ?? '—'}</td>
              <td className="px-2 py-1.5">{values.games ?? '—'}</td>
              {goalie && (
                <td className="px-2 py-1.5">{values.goalieMinutes ?? '—'}</td>
              )}
              {metricValues(sport, goalie, values).map((value, i) => (
                <td key={metrics[i]} className="px-2 py-1.5">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function placeLabel(value: string) {
  return value.startsWith('T') ? `Tied for ${value.slice(1)}` : value
}
