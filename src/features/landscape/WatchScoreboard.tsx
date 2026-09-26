import { otherScoreboardGames, scoreboardStatus } from './scoreboardGames'
import type { ScoreboardGame } from './scoreboardGames'

export function WatchScoreboard({
  games,
  assignedIds,
  now,
}: {
  games: Array<ScoreboardGame>
  assignedIds: Set<string>
  now: number
}) {
  const groups = otherScoreboardGames(games, assignedIds, now)
  if (!groups.length) return null
  return (
    <section aria-label="Around the country" className="mt-6">
      <h2 className="font-display text-xl font-bold text-white">
        Around the country
      </h2>
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="mt-3">
          <h3 className="mb-2 text-xs font-semibold text-white/50">
            {group.title}{' '}
            <span className="font-normal">({group.games.length})</span>
          </h3>
          <div
            className="flex gap-2 overflow-x-auto pb-3"
            tabIndex={0}
            role="region"
            aria-label={`${group.title} scoreboard, scroll for more`}
          >
            {group.games.map((game) => {
              const status = scoreboardStatus(game, now)
              return (
                <article
                  key={game._id}
                  aria-label={`${game.awaySourceName} at ${game.homeSourceName}`}
                  className="app-card w-56 shrink-0 p-3"
                >
                  <p className="mb-2 text-[11px] font-semibold tabular-nums text-white/60">
                    {status.label}
                  </p>
                  {[
                    {
                      name: game.awaySourceName,
                      score: status.away,
                      rank: game.awayRank,
                    },
                    {
                      name: game.homeSourceName,
                      score: status.home,
                      rank: game.homeRank,
                    },
                  ].map((team) => (
                    <div
                      key={team.name}
                      className="flex items-baseline justify-between gap-2 py-0.5 text-sm font-semibold text-white"
                    >
                      <span>
                        {team.name}
                        {team.rank != null && (
                          <span className="ml-1 inline-block text-[11px] font-normal text-white/50">
                            #{team.rank}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {team.score ?? '—'}
                      </span>
                    </div>
                  ))}
                  <p className="mt-2 text-[11px] text-white/40">
                    {game.tvOutlets?.join(' / ') || 'Network TBD'}
                  </p>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </section>
  )
}
