/** Independent results-only research challenger; never consumes external ratings. */
export function replayElo(
  games,
  requests,
  { k = 24, retention = 0.8, homeField = 55 } = {},
) {
  if (
    ![k, retention, homeField].every(Number.isFinite) ||
    k <= 0 ||
    retention < 0 ||
    retention > 1 ||
    homeField < 0
  )
    throw new Error('Invalid Elo policy.')
  const ratings = new Map(),
    classes = new Map(),
    populations = new Map()
  let year,
    position = 0
  const schedule = games
    .filter((g) => g.completed)
    .sort(
      (a, b) =>
        a.kickoffAt - b.kickoffAt || String(a.id).localeCompare(String(b.id)),
    )
  const ids = new Set()
  for (const g of schedule) {
    if (
      ids.has(g.id) ||
      g.homeTeamId === g.awayTeamId ||
      ![g.kickoffAt, g.season, g.homePoints, g.awayPoints].every(
        Number.isFinite,
      )
    )
      throw new Error('Invalid or duplicate Elo game.')
    ids.add(g.id)
  }
  const advance = (season) => {
    if (year !== undefined && season < year)
      throw new Error('Elo seasons must advance chronologically.')
    if (year === season) return
    if (year !== undefined) {
      const grouped = new Map()
      for (const [id, rating] of ratings) {
        const classification = classes.get(id)
        if (!grouped.has(classification)) grouped.set(classification, [])
        grouped.get(classification).push(rating)
      }
      for (const [classification, values] of grouped)
        populations.set(
          classification,
          values.reduce((a, b) => a + b, 0) / values.length,
        )
      for (const [id, rating] of ratings) {
        const center = populations.get(classes.get(id)) ?? 1500
        ratings.set(
          id,
          center + (rating - center) * retention ** (season - year),
        )
      }
    }
    year = season
  }
  const rating = (id, classification) => {
    if (!ratings.has(id))
      ratings.set(id, populations.get(classification) ?? 1500)
    classes.set(id, classification)
    return ratings.get(id)
  }
  const predict = (game) => {
    const difference =
      rating(game.homeTeamId, game.homeClassification) -
      rating(game.awayTeamId, game.awayClassification) +
      (game.neutralSite ? 0 : homeField)
    return { difference, probability: 1 / (1 + 10 ** (-difference / 400)) }
  }
  return [...requests]
    .sort(
      (a, b) =>
        a.featureCutoffAt - b.featureCutoffAt ||
        String(a.gameId).localeCompare(String(b.gameId)),
    )
    .map((request) => {
      if (
        !Number.isFinite(request.featureCutoffAt) ||
        !Number.isFinite(request.kickoffAt) ||
        request.featureCutoffAt >= request.kickoffAt
      )
        throw new Error('Elo prediction must precede kickoff.')
      while (
        position < schedule.length &&
        schedule[position].kickoffAt + 6 * 3600000 < request.featureCutoffAt
      ) {
        const game = schedule[position++]
        advance(game.season)
        const { probability } = predict(game)
        const result =
          game.homePoints > game.awayPoints
            ? 1
            : game.homePoints < game.awayPoints
              ? 0
              : 0.5
        const change = k * (result - probability)
        ratings.set(game.homeTeamId, ratings.get(game.homeTeamId) + change)
        ratings.set(game.awayTeamId, ratings.get(game.awayTeamId) - change)
      }
      advance(request.season)
      const { difference, probability } = predict(request)
      // Point conversion is fitted on earlier forecasts by the evaluation runner.
      return {
        ...request,
        predictedMargin: difference / 25,
        homeWinProbability: probability,
      }
    })
}
