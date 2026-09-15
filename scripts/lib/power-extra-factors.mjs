/** Join source rows by provider game ID and exact recorded team name; no fuzzy identity guessing. */
export function enrichExtraFactors(data, archives) {
  const games = data.games.map((g) => ({
    ...g,
    ratingEvidence: g.ratingEvidence
      ? {
          ...g.ratingEvidence,
          home: { ...g.ratingEvidence.home },
          away: { ...g.ratingEvidence.away },
        }
      : undefined,
  }))
  const byId = new Map(games.map((g) => [String(g.sourceGameId), g]))
  const teamIds = new Map()
  for (const game of games)
    for (const side of ['home', 'away'])
      teamIds.set(
        `${game.season}:${game[side + 'SourceName']}`,
        game[side + 'ProgramId'],
      )
  const returning = new Map(),
    coverage = {
      returning: 0,
      advanced: 0,
      drives: 0,
      unmatchedReturning: 0,
      unmatchedAdvanced: 0,
    }
  const seenAdvanced = new Set(),
    seenDrives = new Set(),
    seenReturning = new Set()
  for (const archive of archives) {
    if (archive.kind === 'returning')
      for (const row of archive.rows) {
        const id = teamIds.get(`${row.season}:${row.team}`)
        if (!id) {
          coverage.unmatchedReturning++
          continue
        }
        const key = `${row.season}:${id}`
        if (seenReturning.has(key))
          throw new Error('Duplicate returning-production identity.')
        seenReturning.add(key)
        if (
          Number.isFinite(row.passingUsage) &&
          row.passingUsage >= 0 &&
          row.passingUsage <= 1 &&
          Number.isFinite(row.percentPassingPPA)
        ) {
          returning.set(key, {
            passingUsage: row.passingUsage,
            passingPpa: row.percentPassingPPA,
          })
          coverage.returning++
        }
      }
    if (archive.kind === 'advanced')
      for (const row of archive.rows) {
        const game = byId.get(String(row.gameId))
        const side =
          game?.homeSourceName === row.team
            ? 'home'
            : game?.awaySourceName === row.team
              ? 'away'
              : null
        if (!game || !side) {
          coverage.unmatchedAdvanced++
          continue
        }
        const key = `${row.gameId}:${side}`
        if (seenAdvanced.has(key))
          throw new Error('Duplicate advanced game identity.')
        seenAdvanced.add(key)
        if (
          game.ratingEvidence?.[side] &&
          Number.isFinite(row.offense?.explosiveness)
        ) {
          game.ratingEvidence[side].explosiveness = row.offense.explosiveness
          coverage.advanced++
        }
      }
    if (archive.kind === 'drives')
      for (const row of archive.rows) {
        const game = byId.get(String(row.gameId))
        if (!game) continue
        const key = `${row.gameId}:${row.id}`
        if (seenDrives.has(key)) throw new Error('Duplicate drive identity.')
        seenDrives.add(key)
        if (
          typeof row.isHomeOffense !== 'boolean' ||
          typeof row.driveResult !== 'string'
        )
          continue
        game.researchTurnoverMargin ??= 0
        game.researchReturnMargin ??= 0
        const result = row.driveResult.toUpperCase()
        if (
          /^(INT|INT TD|INT RETURN TOUCH|FUMBLE|FUMBLE RETURN TD)$/.test(result)
        )
          game.researchTurnoverMargin += row.isHomeOffense ? -1 : 1
        if (
          /^(INT TD|INT RETURN TOUCH|FUMBLE RETURN TD|PUNT RETURN TD|KICKOFF RETURN TD|FG MISSED TD)$/.test(
            result,
          )
        ) {
          const points =
            row.endOffenseScore -
            row.startOffenseScore -
            row.endDefenseScore +
            row.startDefenseScore
          if (
            Number.isFinite(points) &&
            Math.abs(points) >= 6 &&
            Math.abs(points) <= 8
          )
            game.researchReturnMargin += points * (row.isHomeOffense ? 1 : -1)
        }
        coverage.drives++
      }
  }
  return { games, returning, coverage }
}

function solve(matrix, target) {
  const a = matrix.map((r, i) => [...r, target[i]])
  for (let i = 0; i < a.length; i++) {
    let pivot = i
    for (let j = i + 1; j < a.length; j++)
      if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j
    if (Math.abs(a[pivot][i]) < 1e-9) return null
    ;[a[i], a[pivot]] = [a[pivot], a[i]]
    const d = a[i][i]
    for (let j = i; j <= a.length; j++) a[i][j] /= d
    for (let j = 0; j < a.length; j++)
      if (j !== i) {
        const f = a[j][i]
        for (let k = i; k <= a.length; k++) a[j][k] -= f * a[i][k]
      }
  }
  return a.map((r) => r.at(-1))
}

/** Learn a residual point correction, without assigning a manual contribution percentage. */
export function fitFactorCorrection(rows, testSeason, dimensions) {
  if (
    rows.some(
      (r) =>
        !Number.isInteger(r.season) ||
        r.season >= testSeason ||
        r.features.length !== dimensions ||
        ![r.actualMargin, r.predictedMargin, ...r.features].every(
          Number.isFinite,
        ),
    )
  )
    throw new Error('Factor correction requires finite earlier-season rows.')
  if (rows.length < 100)
    return {
      coefficients: Array(dimensions).fill(0),
      fitCount: rows.length,
      trainingSeasons: [],
      sparseFallback: true,
    }
  const matrix = Array.from({ length: dimensions }, () =>
      Array(dimensions).fill(0),
    ),
    target = Array(dimensions).fill(0)
  for (const r of rows)
    for (let i = 0; i < dimensions; i++) {
      target[i] += r.features[i] * (r.actualMargin - r.predictedMargin)
      for (let j = 0; j < dimensions; j++)
        matrix[i][j] += r.features[i] * r.features[j]
    }
  const coefficients = solve(matrix, target)
  return {
    coefficients: coefficients ?? Array(dimensions).fill(0),
    singularFallback: !coefficients,
    fitCount: rows.length,
    trainingSeasons: [...new Set(rows.map((r) => r.season))].sort(
      (a, b) => a - b,
    ),
  }
}

export function replayExtraCorrection(games, requests, returning, policy) {
  if (
    ![
      'quarterback-continuity',
      'turnover-volatility',
      'return-score-volatility',
      'combined-volatility',
    ].includes(policy.name)
  )
    throw new Error('Unknown supplementary factor.')
  const cache = new Map()
  const rows = requests.map((r) => {
    if (!Number.isFinite(r.featureCutoffAt) || r.featureCutoffAt >= r.kickoffAt)
      throw new Error('Invalid pregame cutoff.')
    let features
    if (policy.name === 'quarterback-continuity') {
      const home = returning.get(`${r.season}:${r.homeTeamId}`),
        away = returning.get(`${r.season}:${r.awayTeamId}`)
      features =
        home && away
          ? [
              home.passingUsage - away.passingUsage,
              Math.max(-2, Math.min(2, home.passingPpa)) -
                Math.max(-2, Math.min(2, away.passingPpa)),
            ]
          : [0, 0]
    } else {
      const key = `${r.season}:${r.featureCutoffAt}`
      if (!cache.has(key)) {
        const totals = new Map()
        for (const g of games) {
          if (
            !g.completed ||
            g.season !== r.season ||
            g.kickoffAt + 6 * 3_600_000 >= r.featureCutoffAt ||
            !Number.isFinite(g.researchTurnoverMargin) ||
            !Number.isFinite(g.researchReturnMargin)
          )
            continue
          for (const [id, sign] of [
            [g.homeTeamId, 1],
            [g.awayTeamId, -1],
          ]) {
            const t = totals.get(id) ?? [0, 0, 0]
            t[0] += sign * g.researchTurnoverMargin
            t[1] += sign * g.researchReturnMargin
            t[2]++
            totals.set(id, t)
          }
        }
        cache.set(key, totals)
      }
      const totals = cache.get(key),
        home = totals.get(r.homeTeamId) ?? [0, 0, 0],
        away = totals.get(r.awayTeamId) ?? [0, 0, 0]
      const diff = (i) =>
        home[i] / Math.max(1, home[2]) - away[i] / Math.max(1, away[2])
      features =
        policy.name === 'turnover-volatility'
          ? [diff(0)]
          : policy.name === 'return-score-volatility'
            ? [diff(1)]
            : [diff(0), diff(1)]
    }
    return { ...r, features }
  })
  const fits = []
  const output = []
  for (const season of [...new Set(rows.map((r) => r.season))].sort(
    (a, b) => a - b,
  )) {
    const fit = fitFactorCorrection(
      rows.filter(
        (r) =>
          r.season < season &&
          r.homeClassification === 'fbs' &&
          r.awayClassification === 'fbs',
      ),
      season,
      rows[0].features.length,
    )
    fits.push({ season, fit })
    output.push(
      ...rows
        .filter((r) => r.season === season)
        .map((r) => ({
          ...r,
          predictedMargin:
            r.predictedMargin +
            r.features.reduce((sum, x, i) => sum + x * fit.coefficients[i], 0),
        })),
    )
  }
  return { forecasts: output, fits }
}
