import type { ScheduleState } from './teamSeasonModel'

export function HockeyNpi({ state }: { state: ScheduleState['npi'] }) {
  if (!state) return null
  const latest = state.data?.latest
  if (!latest)
    return (
      <p className="my-2 text-[11px] text-slate-500">
        {state.isPending
          ? 'Loading NPI rankings…'
          : state.isError || state.data?.refreshFailed
            ? 'NPI rankings unavailable. The weekly refresh will retry.'
            : 'NPI rankings have not been collected for this season.'}
      </p>
    )
  return (
    <details className="mb-2 text-[11px] text-slate-500">
      <summary className="min-h-8 cursor-pointer content-center py-1">
        <strong className="text-[#00274c]">
          Michigan #{latest.michiganRank ?? '—'} ·{' '}
          {latest.final ? 'Final NPI' : 'Current NPI'}
        </strong>
        {' · '}
        {new Date(latest.observedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })}
        {' · All rankings'}
      </summary>
      <p className="mb-2 mt-0">
        {latest.final
          ? 'End-of-season rankings from the CHN season archive.'
          : 'Refreshed Mondays at 13:07 UTC. All games show the latest saved ranks, including games already played.'}{' '}
        These are not rankings at game time. A dash means unavailable or
        exhibition.
        {state.data?.refreshFailed &&
          ' Refresh failed; showing the last valid rankings.'}{' '}
        <a
          className="underline"
          href={latest.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          College Hockey News
        </a>
      </p>
      <div
        className="max-h-64 max-w-md overflow-auto border border-slate-200"
        role="region"
        aria-label="National hockey NPI rankings"
        tabIndex={0}
      >
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">
            {latest.final ? 'Final' : 'Current'} national NPI rankings
          </caption>
          <thead className="bg-slate-100">
            <tr>
              {['Rank', 'Team', 'NPI'].map((label) => (
                <th key={label} scope="col" className="px-2 py-1">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {latest.teams.map((team) => (
              <tr
                key={team.sourceTeamId}
                className={
                  team.sourceTeamId === '31'
                    ? 'bg-amber-50 font-bold text-[#00274c]'
                    : 'border-t border-slate-100'
                }
              >
                <td className="px-2 py-1">{team.rank}</td>
                <th scope="row" className="px-2 py-1 font-semibold">
                  {team.team}
                </th>
                <td className="px-2 py-1">{team.npi.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
