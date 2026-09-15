import { censoredMargin, resultMargin } from '../../convex/powerMargin.ts'

const HOURS = 6 * 3_600_000
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

export const FACTOR_POLICIES = [
  { name: 'recalibrated-foundation-control', kind: 'control' },
  { name: 'repeated-surprise-2', kind: 'surprise', window: 2 },
  { name: 'repeated-surprise-3', kind: 'surprise', window: 3 },
  {
    name: 'recent-surprise-control',
    kind: 'surprise',
    window: 2,
    repeated: false,
  },
  { name: 'ppa-balanced-control', kind: 'efficiency', metric: 'ppa' },
  {
    name: 'ppa-faster-offense',
    kind: 'efficiency',
    metric: 'ppa',
    offenseRetention: 0.25,
    defenseRetention: 0.75,
  },
  {
    name: 'ppa-faster-defense',
    kind: 'efficiency',
    metric: 'ppa',
    offenseRetention: 0.75,
    defenseRetention: 0.25,
  },
  { name: 'adjusted-success-rate', kind: 'efficiency', metric: 'successRate' },
  {
    name: 'adjusted-points-per-drive',
    kind: 'efficiency',
    metric: 'pointsPerDrive',
  },
  {
    name: 'ppa-opponent-uncertainty',
    kind: 'efficiency',
    metric: 'ppa',
    uncertainty: true,
  },
  {
    name: 'surprise-opponent-uncertainty',
    kind: 'surprise',
    window: 2,
    uncertainty: true,
  },
]

function validateRequests(requests) {
  const seen = new Set()
  for (const row of requests) {
    const key = `${row.season}:${row.gameId}`
    if (
      seen.has(key) ||
      !Number.isFinite(row.featureCutoffAt) ||
      !Number.isFinite(row.kickoffAt) ||
      row.featureCutoffAt >= row.kickoffAt ||
      !Number.isFinite(row.predictedMargin)
    )
      throw new Error('Expected unique finite pregame requests.')
    seen.add(key)
  }
}

function availableGames(games, request) {
  return games.filter(
    (g) =>
      g.completed &&
      g.season <= request.season &&
      g.season >= request.season - 2 &&
      g.kickoffAt + HOURS < request.featureCutoffAt,
  )
}

/** Precision proxy, not a posterior variance: experience against FBS opposition. */
function opponentConfidence(games, season) {
  const counts = new Map()
  for (const g of games) {
    for (const [side, opposite] of [
      ['home', 'away'],
      ['away', 'home'],
    ]) {
      if (g[opposite + 'Classification'] !== 'fbs') continue
      const id = g[side + 'TeamId']
      counts.set(id, (counts.get(id) ?? 0) + 0.5 ** (season - g.season))
    }
  }
  return (id) => Math.min(1, Math.sqrt(((counts.get(id) ?? 0) + 1) / 12))
}

/** A repeated forecast-error correction screens adaptation without rewriting the prior model. */
export function replaySurprise(games, requests, policy) {
  validateRequests(requests)
  if (![2, 3].includes(policy.window))
    throw new Error('Invalid surprise window.')
  const forecasts = new Map(requests.map((r) => [r.gameId, r]))
  const cache = new Map()
  return requests.map((request) => {
    const key = `${request.season}:${request.featureCutoffAt}`
    if (!cache.has(key)) {
      const available = availableGames(games, request)
      const confidence = opponentConfidence(available, request.season)
      const histories = new Map()
      for (const game of available
        .filter((g) => g.season === request.season)
        .sort((a, b) => b.kickoffAt - a.kickoffAt)) {
        const prior = forecasts.get(game.id)
        if (
          !prior ||
          prior.kickoffAt !== game.kickoffAt ||
          prior.featureCutoffAt >= game.kickoffAt
        )
          continue
        const raw = game.homePoints - game.awayPoints
        const capped = resultMargin(
          game.homePoints,
          game.awayPoints,
          game.overtimePeriods ?? 0,
          'censored',
        )
        const observed =
          game.overtimePeriods > 0
            ? capped
            : censoredMargin(capped, raw, prior.predictedMargin)
        const residual = clamp(observed - prior.predictedMargin, -21, 21)
        for (const [side, opposite, sign] of [
          ['home', 'away', 1],
          ['away', 'home', -1],
        ]) {
          const id = game[side + 'TeamId']
          if (!histories.has(id)) histories.set(id, [])
          histories
            .get(id)
            .push(
              residual *
                sign *
                (policy.uncertainty
                  ? confidence(game[opposite + 'TeamId'])
                  : 1),
            )
        }
      }
      const corrections = new Map()
      for (const [id, history] of histories) {
        const recent = history.slice(0, policy.window)
        const confirmed =
          recent.length === policy.window &&
          (recent.every((x) => x > 0) || recent.every((x) => x < 0))
        corrections.set(
          id,
          policy.repeated !== false && !confirmed
            ? 0
            : recent.reduce((sum, x) => sum + x, 0) / recent.length,
        )
      }
      cache.set(key, corrections)
    }
    const correction = cache.get(key)
    return {
      ...request,
      predictedMargin:
        request.predictedMargin +
        (correction.get(request.homeTeamId) ?? 0) -
        (correction.get(request.awayTeamId) ?? 0),
    }
  })
}

/** Independent opponent-adjusted unit models; historical evidence availability is reconstructed. */
export function replayUnitFactor(games, requests, policy) {
  validateRequests(requests)
  if (
    !['ppa', 'successRate', 'pointsPerDrive', 'explosiveness'].includes(
      policy.metric,
    )
  )
    throw new Error('Unsupported efficiency factor.')
  const offenseRetention = policy.offenseRetention ?? 0.5
  const defenseRetention = policy.defenseRetention ?? 0.5
  if (
    ![offenseRetention, defenseRetention].every(
      (x) => Number.isFinite(x) && x > 0 && x <= 1,
    )
  )
    throw new Error('Invalid unit retention.')
  const cache = new Map()
  return requests.map((request) => {
    const key = `${request.season}:${request.featureCutoffAt}`
    if (!cache.has(key)) {
      const available = availableGames(games, request)
      const confidence = opponentConfidence(available, request.season)
      const rows = []
      for (const game of available) {
        for (const [side, opposite] of [
          ['home', 'away'],
          ['away', 'home'],
        ]) {
          const drives = policy.metric === 'pointsPerDrive'
          const evidence =
            game.ratingEvidence?.[side + (drives ? 'Drives' : '')]
          const count = evidence?.[drives ? 'possessions' : 'plays']
          const value = drives
            ? evidence?.points / count
            : evidence?.[policy.metric]
          if (
            !Number.isFinite(count) ||
            count < 1 ||
            !Number.isFinite(value) ||
            (policy.metric === 'successRate' && (value < 0 || value > 1))
          )
            continue
          const team = game[side + 'TeamId'],
            opponent = game[opposite + 'TeamId']
          const weight = Math.min(count, drives ? 12 : 80)
          const age = request.season - game.season
          rows.push({
            team,
            opponent,
            value,
            weight: weight * 0.5 ** age,
            offenseWeight:
              weight *
              offenseRetention ** age *
              (policy.uncertainty ? confidence(opponent) : 1),
            defenseWeight:
              weight *
              defenseRetention ** age *
              (policy.uncertainty ? confidence(team) : 1),
          })
        }
      }
      const total = rows.reduce((s, r) => s + r.weight, 0)
      const baseline = total
        ? rows.reduce((s, r) => s + r.value * r.weight, 0) / total
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
      const ridge = policy.metric === 'pointsPerDrive' ? 24 : 150
      for (let iteration = 0; iteration < 35; iteration++) {
        for (const id of ids) {
          let numerator = 0,
            denominator = ridge
          for (const r of attacking.get(id)) {
            numerator +=
              r.offenseWeight * (r.value - baseline + defense.get(r.opponent))
            denominator += r.offenseWeight
          }
          offense.set(id, numerator / denominator)
          numerator = 0
          denominator = ridge
          for (const r of defending.get(id)) {
            numerator +=
              r.defenseWeight * (baseline + offense.get(r.team) - r.value)
            denominator += r.defenseWeight
          }
          defense.set(id, numerator / denominator)
        }
      }
      const scale = policy.metric === 'pointsPerDrive' ? 12 : 65
      cache.set(
        key,
        new Map(
          ids.map((id) => [id, (offense.get(id) + defense.get(id)) * scale]),
        ),
      )
    }
    const ratings = cache.get(key)
    return {
      ...request,
      predictedMargin:
        (ratings.get(request.homeTeamId) ?? 0) -
        (ratings.get(request.awayTeamId) ?? 0) +
        (request.neutralSite ? 0 : 2.5),
    }
  })
}

export function auditFactorCoverage(data, seasons) {
  return seasons.map((season) => {
    const games = data.games.filter(
      (g) =>
        g.season === season &&
        g.completed &&
        (g.homeClassification === 'fbs' || g.awayClassification === 'fbs'),
    )
    const both = (test) =>
      games.filter((g) => ['home', 'away'].every((side) => test(g, side)))
        .length
    return {
      season,
      games: games.length,
      ppa: both(
        (g, s) =>
          Number.isFinite(g.ratingEvidence?.[s]?.ppa) &&
          g.ratingEvidence[s].plays > 0,
      ),
      successRate: both(
        (g, s) =>
          Number.isFinite(g.ratingEvidence?.[s]?.successRate) &&
          g.ratingEvidence[s].plays > 0,
      ),
      pointsPerDrive: both(
        (g, s) =>
          Number.isFinite(g.ratingEvidence?.[s + 'Drives']?.points) &&
          g.ratingEvidence[s + 'Drives'].possessions > 0,
      ),
      contemporaneousEvidence: games.filter(
        (g) =>
          Number.isFinite(g.ratingEvidence?.observedAt) &&
          g.ratingEvidence.observedAt < Date.UTC(season + 1, 2, 1),
      ).length,
    }
  })
}
