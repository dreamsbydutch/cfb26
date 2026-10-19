import {
  getSeasonCoach,
  getSeasonHistory,
  seasonHistorySources,
} from './seasonHistory'
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
import { EmptyState, ErrorState, LoadingState } from '~/components/AppShell'

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
    <div className="space-y-8">
      <nav
        aria-label="Season sections"
        className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-[#00274c]"
      >
        <a className="underline underline-offset-4" href="#season-contributors">
          Player contributions
        </a>
        <a className="underline underline-offset-4" href="#season-postseason">
          Postseason
        </a>
        <a className="underline underline-offset-4" href="#season-schedule">
          Schedule &amp; results
        </a>
      </nav>
      <section aria-label="Season summary" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryFact
            label={history ? 'Final record' : 'Season record'}
            value={history?.overall ?? (results ? results.record : '—')}
            detail={
              history
                ? 'Completed season'
                : schedule.isPending
                  ? 'Loading results'
                  : schedule.isError
                    ? 'Results unavailable'
                    : results?.played
                      ? `${results.played} games played`
                      : results
                        ? 'No recorded regular-season results'
                        : 'No schedule recorded'
            }
          />
          <SummaryFact
            label={history?.conference ?? 'Conference'}
            value={
              history?.conferenceRecord ?? (results ? results.conference : '—')
            }
            detail={
              history
                ? `${placeLabel(history.conferenceFinish)} in ${history.conference}`
                : 'Conference games only'
            }
          />
          <SummaryFact label="Postseason result" value={postseason} />
          <SummaryFact
            label="Head coach"
            value={coach?.name ?? '—'}
            detail={coach ? 'Season coaching staff' : 'Not recorded'}
            sourceHref={coach?.sourceUrl}
          />
        </div>
        {!!honors.length && (
          <ul
            aria-label="Season accomplishments"
            className="m-0 flex list-none flex-wrap gap-2 p-0"
          >
            {honors.map((honor) => (
              <li
                key={honor}
                className="rounded-lg border border-[#d5ad00] bg-[#ffcb05]/20 px-3 py-2 text-sm font-extrabold text-[#00274c]"
              >
                {honor}
              </li>
            ))}
          </ul>
        )}
        {results && (
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ['Home', results.home],
              ['Away', results.away],
              ['Neutral', results.neutral],
              [
                sport === 'hockey' ? 'Goals / game' : 'Points / game',
                results.scoringFor?.toFixed(sport === 'hockey' ? 2 : 1) ?? '—',
              ],
              [
                sport === 'hockey'
                  ? 'Goals allowed / game'
                  : 'Points allowed / game',
                results.scoringAgainst?.toFixed(sport === 'hockey' ? 2 : 1) ??
                  '—',
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-slate-500">
                  {label}
                </dt>
                <dd className="m-0 mt-1 font-bold tabular-nums text-[#00274c]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {results && (
          <p className="text-xs text-slate-500">
            Records exclude exhibitions. Scoring averages cover{' '}
            {results.scoredGames} games with recorded scores.
            {sport === 'hockey'
              ? ' Shootout games retain the official tie.'
              : ''}
          </p>
        )}
      </section>

      <section
        id="season-contributors"
        className="scroll-mt-24 space-y-4 lg:scroll-mt-36"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#00274c]">
              Players who contributed
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Players with recorded appearances in this season.
            </p>
          </div>
          <button
            className="app-control px-3 py-2 text-sm font-bold"
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
            Could not load player contributions. The schedule is still available
            below.
          </ErrorState>
        ) : !contributors.length ? (
          <EmptyState title="No player appearances recorded">
            The full roster is available separately. Contributions appear when
            games played and season statistics are recorded.
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {leaderFields.map(({ label, keys }) => {
                const leader = seasonLeaders(
                  sport === 'hockey' ? skaters : contributors,
                  keys,
                )
                return (
                  <SummaryFact
                    key={label}
                    label={`${label} leader${leader && leader.names.length > 1 ? 's' : ''}`}
                    value={leader?.names.join(' / ') ?? '—'}
                    detail={
                      leader
                        ? `${leader.total} ${label.toLowerCase()} · season total`
                        : 'Not recorded'
                    }
                  />
                )
              })}
            </div>
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
            <p className="text-xs text-slate-500">
              {contributors.length} players with recorded appearances. A dash
              means unknown; a recorded zero remains zero.{' '}
              {sport === 'basketball'
                ? 'Ordered by total minutes. MPG, PPG, RPG and APG are per game.'
                : 'Skaters are ordered by points; goalies by minutes played. SV% and GAA use saved goaltending totals.'}
            </p>
          </>
        )}
      </section>

      <section
        id="season-postseason"
        className="scroll-mt-24 space-y-4 lg:scroll-mt-36"
      >
        <h2 className="text-xl font-black text-[#00274c]">
          Postseason &amp; accomplishments
        </h2>
        <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
          <p className="m-0 text-lg font-extrabold text-[#00274c]">
            {postseason}
          </p>
          {history && (
            <p className="mt-2 text-sm text-slate-600">
              {history.conference} tournament:{' '}
              {history.tournamentFinish
                ? placeLabel(history.tournamentFinish)
                : 'Cancelled'}
              .
            </p>
          )}
          {history?.note && (
            <p className="mt-2 text-sm text-slate-600">{history.note}</p>
          )}
          {history && (
            <p className="mt-3 text-xs text-slate-500">
              <a
                className="underline underline-offset-2"
                href={seasonHistorySources[sport]}
                target="_blank"
                rel="noreferrer"
              >
                Michigan Athletics season history
              </a>
              {history.detailUrl && (
                <>
                  {' '}
                  ·{' '}
                  <a
                    className="underline underline-offset-2"
                    href={history.detailUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Season details
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        {!!results?.postseason.length && (
          <ol className="m-0 list-none divide-y divide-slate-200 rounded-xl border border-slate-200 px-4">
            {results.postseason.map((game) => (
              <li
                key={game.sourceGameId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="m-0 text-xs text-slate-500">
                    <time dateTime={game.date}>
                      {new Date(`${game.date}T12:00:00Z`).toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric', timeZone: 'UTC' },
                      )}
                    </time>{' '}
                    · {game.tournament || 'Postseason'}
                  </p>
                  <p className="m-0 mt-1 font-bold text-[#00274c]">
                    {game.opponent}
                  </p>
                </div>
                <div className="text-right">
                  <p className="m-0 font-extrabold tabular-nums">
                    {game.status === 'final' && game.result
                      ? `${game.result} ${game.michiganScore}–${game.opponentScore}`
                      : game.status.replaceAll('_', ' ')}
                  </p>
                  {game.recapUrl && (
                    <a
                      className="text-xs underline underline-offset-2"
                      href={game.recapUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Game recap
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div id="season-schedule" className="scroll-mt-24 lg:scroll-mt-36">
        <TeamSchedule sport={sport} season={season} schedule={schedule} />
      </div>
    </div>
  )
}

function SummaryFact({
  label,
  value,
  detail,
  sourceHref,
}: {
  label: string
  value: string
  detail?: string
  sourceHref?: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <p className="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="m-0 mt-2 text-xl font-extrabold leading-tight text-[#00274c]">
        {value}
      </p>
      {detail && (
        <p className="m-0 mt-2 text-xs text-slate-500">
          {sourceHref ? (
            <a
              className="underline underline-offset-2"
              href={sourceHref}
              target="_blank"
              rel="noreferrer"
            >
              {detail}
            </a>
          ) : (
            detail
          )}
        </p>
      )}
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
      className="overflow-x-auto rounded-xl border border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <table className="w-full whitespace-nowrap text-left text-sm tabular-nums">
        <caption className="bg-slate-50 px-3 py-2 text-left text-sm font-bold text-[#00274c]">
          {title}
        </caption>
        <thead className="bg-[#00274c] text-xs text-white">
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
                className={`px-3 py-2 ${label === 'Player' ? 'sticky left-0 z-10 bg-[#00274c]' : ''}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map(({ _id, values }) => (
            <tr key={_id}>
              <th
                scope="row"
                className="sticky left-0 z-10 min-w-36 whitespace-normal bg-white px-3 py-3 font-semibold text-[#00274c]"
              >
                {values.name}
              </th>
              <td className="px-3 py-3">{values.position ?? '—'}</td>
              <td className="px-3 py-3">{values.games ?? '—'}</td>
              {goalie && (
                <td className="px-3 py-3">{values.goalieMinutes ?? '—'}</td>
              )}
              {metricValues(sport, goalie, values).map((value, i) => (
                <td key={metrics[i]} className="px-3 py-3">
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
