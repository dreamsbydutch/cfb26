/** Independent additive offense/defense model, in PPA per play; research only. */
export function replayEfficiency(games, requests) {
  const cache = new Map()
  return requests.map((request) => {
    if (
      !Number.isFinite(request.featureCutoffAt) ||
      request.featureCutoffAt >= request.kickoffAt
    )
      throw new Error('Efficiency forecast must precede kickoff.')
    const key = `${request.season}:${request.featureCutoffAt}`
    if (!cache.has(key)) {
      const rows = []
      for (const game of games) {
        if (
          !game.completed ||
          game.season > request.season ||
          game.season < request.season - 2 ||
          game.kickoffAt + 6 * 3600000 >= request.featureCutoffAt
        )
          continue
        for (const [side, opponent] of [
          ['home', 'away'],
          ['away', 'home'],
        ]) {
          const evidence = game.ratingEvidence?.[side]
          if (
            !evidence ||
            !Number.isFinite(evidence.ppa) ||
            !Number.isFinite(evidence.plays) ||
            evidence.plays < 1
          )
            continue
          rows.push({
            team: game[side + 'TeamId'],
            opponent: game[opponent + 'TeamId'],
            value:
              evidence.ppa -
              (game.neutralSite ? 0 : ((side === 'home' ? 1 : -1) * 2.5) / 130),
            weight:
              Math.min(evidence.plays, 80) *
              0.5 ** (request.season - game.season),
          })
        }
      }
      const weight = rows.reduce((sum, r) => sum + r.weight, 0)
      const baseline = weight
        ? rows.reduce((sum, r) => sum + r.value * r.weight, 0) / weight
        : 0
      const ids = [...new Set(rows.flatMap((r) => [r.team, r.opponent]))].sort()
      const offense = new Map(ids.map((id) => [id, 0])),
        defense = new Map(ids.map((id) => [id, 0]))
      const attacking = new Map(ids.map((id) => [id, []])),
        defending = new Map(ids.map((id) => [id, []]))
      for (const row of rows) {
        attacking.get(row.team).push(row)
        defending.get(row.opponent).push(row)
      }
      for (let iteration = 0; iteration < 35; iteration++)
        for (const id of ids) {
          let numerator = 0,
            denominator = 150
          for (const r of attacking.get(id)) {
            numerator +=
              r.weight * (r.value - baseline + defense.get(r.opponent))
            denominator += r.weight
          }
          offense.set(id, numerator / denominator)
          numerator = 0
          denominator = 150
          for (const r of defending.get(id)) {
            numerator += r.weight * (baseline + offense.get(r.team) - r.value)
            denominator += r.weight
          }
          defense.set(id, numerator / denominator)
        }
      cache.set(
        key,
        new Map(
          ids.map((id) => [id, (offense.get(id) + defense.get(id)) * 65]),
        ),
      )
    }
    const ratings = cache.get(key)
    const predictedMargin =
      (ratings.get(request.homeTeamId) ?? 0) -
      (ratings.get(request.awayTeamId) ?? 0) +
      (request.neutralSite ? 0 : 2.5)
    return {
      ...request,
      predictedMargin,
      homeWinProbability: 1 / (1 + Math.exp(-predictedMargin / 14)),
    }
  })
}
