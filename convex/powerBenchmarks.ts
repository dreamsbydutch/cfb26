import { chooseChampion, evaluateForecasts } from './ratingBacktest.ts'
import type { BacktestForecast, ModelEvaluation  } from './ratingBacktest.ts'

type ForecastEvaluation = ModelEvaluation & {
  forecasts: Array<BacktestForecast>
}

/** Early-season improvement is required in addition to the existing all-season gate. */
export function chooseEarlyPowerChampion(
  incumbent: ForecastEvaluation,
  challengers: ReadonlyArray<ForecastEvaluation>,
  market: ReadonlyMap<string, number>,
) {
  const selection = chooseChampion(incumbent, challengers)
  const early = (model: ForecastEvaluation) =>
    model.forecasts.filter((f) => f.week <= 4 && f.seasonType !== 'postseason')
  const baseline = early(incumbent),
    metrics = evaluateForecasts(baseline).overall
  const common = baseline.filter((f) => market.has(f.gameId))
  for (const challenger of challengers) {
    const decision = selection.decisions[challenger.modelVersion]
    const rows = early(challenger),
      scored = evaluateForecasts(rows).overall
    const identity = (f: BacktestForecast) =>
      `${f.season}:${f.gameId}:${f.featureCutoffAt}:${f.actualMargin}`
    const baselineIds = baseline.map(identity).sort(),
      candidateIds = rows.map(identity).sort()
    if (JSON.stringify(baselineIds) !== JSON.stringify(candidateIds))
      decision.reasons.push(
        'Early-season games and cutoffs must match the incumbent.',
      )
    if (scored.marginMae >= metrics.marginMae)
      decision.reasons.push('Early-season margin MAE did not improve.')
    if (scored.brier >= metrics.brier)
      decision.reasons.push('Early-season Brier score did not improve.')
    const candidateMarket = compareMarketMargins(rows, market).early
    const baselineMarket = compareMarketMargins(baseline, market).early
    if (
      !common.length ||
      !candidateMarket ||
      !baselineMarket ||
      candidateMarket.count !== common.length ||
      candidateMarket.modelMae >= baselineMarket.modelMae
    )
      decision.reasons.push(
        'Matched-market early-season model MAE did not improve.',
      )
    decision.accepted = decision.reasons.length === 0
  }
  const accepted = challengers.filter(
    (c) => selection.decisions[c.modelVersion].accepted,
  )
  return {
    ...selection,
    champion: accepted.length
      ? chooseChampion(incumbent, accepted).champion
      : incumbent,
  }
}

export type MarketGame = {
  id: number
  season: number
  lines: Array<{
    provider: string
    spread?: number | null
    spreadOpen?: number | null
  }>
}

/** Equal provider weighting; duplicates are errors, absent opening quotes stay absent. */
export function marketMargins(
  rows: ReadonlyArray<MarketGame>,
  kind: 'opening' | 'archived',
) {
  const result = new Map<string, number>()
  const seenGames = new Set<string>()
  for (const row of rows) {
    const id = String(row.id)
    if (!Number.isInteger(row.id) || seenGames.has(id))
      throw new Error('Invalid or duplicate benchmark game.')
    seenGames.add(id)
    const seen = new Set<string>(),
      values: Array<number> = []
    for (const line of row.lines) {
      if (seen.has(line.provider))
        throw new Error('Duplicate benchmark provider.')
      seen.add(line.provider)
      const value = kind === 'opening' ? line.spreadOpen : line.spread
      if (typeof value === 'number' && Number.isFinite(value))
        values.push(-value)
    }
    if (values.length) {
      values.sort((a, b) => a - b)
      const mid = Math.floor(values.length / 2)
      result.set(
        id,
        values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2,
      )
    }
  }
  return result
}

/** Only common games count. Rank agreement is never used as predictive ground truth. */
export function compareMarketMargins(
  forecasts: ReadonlyArray<BacktestForecast>,
  margins: ReadonlyMap<string, number>,
) {
  const matched = forecasts.filter((f) => margins.has(f.gameId))
  const summarize = (rows: ReadonlyArray<BacktestForecast>) => {
    if (!rows.length) return null
    const errors = rows.map((row) => ({
      model: Math.abs(row.predictedMargin - row.actualMargin),
      market: Math.abs(margins.get(row.gameId)! - row.actualMargin),
    }))
    return {
      count: rows.length,
      modelMae: errors.reduce((s, r) => s + r.model, 0) / rows.length,
      marketMae: errors.reduce((s, r) => s + r.market, 0) / rows.length,
      modelWinAccuracy:
        rows.filter(
          (r) => Math.sign(r.predictedMargin) === Math.sign(r.actualMargin),
        ).length / rows.length,
      marketWinAccuracy:
        rows.filter(
          (r) =>
            Math.sign(margins.get(r.gameId)!) === Math.sign(r.actualMargin),
        ).length / rows.length,
      meanPairedErrorDifference:
        errors.reduce((s, r) => s + r.model - r.market, 0) / rows.length,
    }
  }
  return {
    available: forecasts.length,
    matched: matched.length,
    missing: forecasts.length - matched.length,
    overall: summarize(matched),
    early: summarize(
      matched.filter((f) => f.week <= 4 && f.seasonType !== 'postseason'),
    ),
    bySeason: Object.fromEntries(
      [...new Set(matched.map((f) => f.season))].map((season) => [
        season,
        summarize(
          matched.filter(
            (f) =>
              f.season === season &&
              f.week <= 4 &&
              f.seasonType !== 'postseason',
          ),
        ),
      ]),
    ),
  }
}

export function scoreExternalForecasts(
  rows: ReadonlyArray<BacktestForecast & { observedAt: number }>,
) {
  if (
    rows.some(
      (r) =>
        !Number.isFinite(r.observedAt) ||
        r.observedAt >= r.kickoffAt ||
        r.featureCutoffAt < r.observedAt,
    )
  )
    throw new Error('External benchmark was not available at forecast time.')
  return evaluateForecasts(rows)
}
