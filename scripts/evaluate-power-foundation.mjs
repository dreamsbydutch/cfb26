import { rosterContexts, fitRosterForecast } from '../convex/powerRoster.ts'
import { buildPowerRatingEdition } from '../convex/ratingSystem.ts'
import { offensiveReturningShare } from '../convex/powerHistory.ts'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { evaluatePowerPolicies } from '../convex/powerResearch.ts'
import { isFbsGame, isResolvedGame } from '../convex/gameStatus.ts'
import {
  fitPowerCalibration,
  calibrateForecast,
} from '../convex/powerCalibration.ts'
import { chooseChampion, evaluateForecasts } from '../convex/ratingBacktest.ts'

const [inputPath, outputPath, onlyPolicy] = process.argv.slice(2)
if (!inputPath || !outputPath)
  throw new Error(
    'Usage: node scripts/evaluate-power-foundation.mjs <enriched-data.json> <new-report.json> [policy-index]',
  )
const buffer = await readFile(inputPath),
  data = JSON.parse(buffer.toString('utf8'))
const seasons = [...new Set(data.games.map((g) => g.season))].sort(
  (a, b) => a - b,
)
const testSeasons = seasons.slice(4).filter((season) => {
  const schedule = data.games.filter((g) => g.season === season && isFbsGame(g))
  return schedule.length > 0 && schedule.every(isResolvedGame)
})
const classification = new Map()
for (const g of data.games) {
  classification.set(g.homeProgramId, g.homeClassification)
  classification.set(g.awayProgramId, g.awayClassification)
}
const teams = data.programs
  .filter((p) => classification.has(p._id))
  .map((p) => ({
    id: p._id,
    name: p.name,
    classification: classification.get(p._id) === 'fbs' ? 'fbs' : 'fcs',
  }))
const games = data.games
  .filter(
    (g) =>
      g.completed &&
      Number.isFinite(g.homePoints) &&
      Number.isFinite(g.awayPoints),
  )
  .map((g) => ({
    id: String(g.sourceGameId),
    homeTeamId: g.homeProgramId,
    awayTeamId: g.awayProgramId,
    homeClassification: g.homeClassification,
    awayClassification: g.awayClassification,
    homePoints: g.homePoints,
    awayPoints: g.awayPoints,
    season: g.season,
    seasonType: g.seasonType,
    week: g.week,
    kickoffAt: g.startTime,
    completed: true,
    neutralSite: g.neutralSite,
    overtimePeriods: Math.max(
      0,
      (g.homeLineScores?.length ?? 4) - 4,
      (g.awayLineScores?.length ?? 4) - 4,
    ),
    ratingEvidence: g.ratingEvidence,
  }))
const personnel = (data.profiles ?? []).flatMap((p) => {
  const share = offensiveReturningShare(p)
  return share !== null && Number.isFinite(share) && share >= 0 && share <= 1
    ? [
        {
          teamId: p.programId,
          season: p.season,
          returningShare: share,
          observedAt: Date.UTC(p.season, 7, 1),
          effectiveAt: Date.UTC(p.season, 7, 1),
          expiresAt: Date.UTC(p.season + 1, 2, 1),
          source: 'cfbd-offensive-usage-reconstruction',
        },
      ]
    : []
})
const base = {
  version: 'v4-incumbent',
  historySeasons: 5,
  priorGames: 4,
  transitionPriorGames: 2,
  seasonRetention: 1,
  fullWeightResults: true,
  divisionAdjustment: true,
  halfLifeDays: null,
  turnoverSensitive: false,
  fixedHomeField: 2.5,
  efficiencyWeight: 0.2,
  offensiveContinuity: true,
}
const candidates = [
  { policy: base, fcs: true },
  {
    policy: {
      ...base,
      version: 'huber-score',
      marginTreatment: 'huber',
      efficiencyWeight: 0,
    },
    fcs: true,
  },
  {
    policy: { ...base, version: 'huber-blend', marginTreatment: 'huber' },
    fcs: true,
  },
  {
    policy: {
      ...base,
      version: 'huber-roster',
      marginTreatment: 'huber',
      rosterWeight: 0.5,
    },
    fcs: true,
  },
  {
    policy: {
      ...base,
      version: 'huber-score-roster',
      marginTreatment: 'huber',
      efficiencyWeight: 0,
      rosterWeight: 0.5,
    },
    fcs: true,
  },
  {
    policy: {
      ...base,
      version: 'continuous-roster-half',
      marginTreatment: 'huber',
      continuousEfficiency: true,
      rosterWeight: 0.5,
    },
    fcs: true,
  },
  {
    policy: {
      ...base,
      version: 'continuous-roster',
      marginTreatment: 'huber',
      marginResidualLimit: 35,
      continuousEfficiency: true,
      rosterWeight: 1,
    },
    fcs: true,
  },
  {
    policy: {
      ...base,
      version: 'robust-score-roster',
      marginTreatment: 'huber',
      marginResidualLimit: 35,
      efficiencyWeight: 0,
      rosterWeight: 1,
    },
    fcs: true,
  },
]
for (const priorGames of [6, 8])
  candidates.push({
    policy: {
      ...candidates[6].policy,
      version: `continuous-roster-prior-${priorGames}`,
      priorGames,
    },
    fcs: true,
  })
candidates.push({
  policy: { ...base, version: 'roster-only', rosterWeight: 1 },
  fcs: true,
})
candidates.push({
  policy: { ...base, version: 'roster-half', rosterWeight: 0.5 },
  fcs: true,
})
candidates.push({
  policy: {
    ...base,
    version: 'censored-roster-half',
    rosterWeight: 0.5,
    marginTreatment: 'censored',
  },
  fcs: true,
})
candidates.push({
  policy: { ...base, version: 'censored-only', marginTreatment: 'censored' },
  fcs: true,
})
if (
  onlyPolicy !== undefined &&
  (!Number.isInteger(Number(onlyPolicy)) || !candidates[Number(onlyPolicy)])
)
  throw new Error('Unknown policy index.')
const allContexts = new Map(),
  annual = new Map(),
  training = []
for (const season of seasons) {
  const schedule = games.filter((g) => g.season === season),
    field = new Set(
      schedule.flatMap((g) => [
        ...(g.homeClassification === 'fbs' ? [g.homeTeamId] : []),
        ...(g.awayClassification === 'fbs' ? [g.awayTeamId] : []),
      ]),
    )
  const contexts = rosterContexts(
    data.profiles
      .filter((p) => p.season === season)
      .map((p) => ({ ...p, teamId: p.programId })),
    field,
  )
  for (const [id, context] of contexts)
    allContexts.set(season + ':' + id, context)
  if (!testSeasons.includes(season) && season >= Math.max(...testSeasons))
    continue
  const ids = new Set(schedule.flatMap((g) => [g.homeTeamId, g.awayTeamId]))
  const edition = buildPowerRatingEdition({
    teams: teams
      .filter((t) => ids.has(t.id))
      .map((t) => ({ ...t, classification: field.has(t.id) ? 'fbs' : 'fcs' })),
    games: schedule,
    season,
    week: 30,
    cutoffAt: Date.UTC(season + 1, 7, 1),
    evidenceCutoffAt: Date.now(),
    marginTreatment: 'huber',
    fixedHomeField: 2.5,
    efficiencyWeight: 0.2,
  })
  const previous = annual.get(season - 1)
  for (const r of edition.ratings) {
    const prior = previous?.get(r.teamId),
      context = contexts.get(r.teamId)
    if (r.published && r.gamesPlayed >= 8 && prior !== undefined && context)
      training.push({ season, prior, context, target: r.power })
  }
  annual.set(
    season,
    new Map(
      edition.ratings
        .filter((r) => r.published)
        .map((r) => [r.teamId, r.power]),
    ),
  )
}
const rosterFits = new Map()
for (const season of seasons) {
  const rows = training.filter((r) => r.season < season)
  if (rows.length >= 200)
    rosterFits.set(season, fitRosterForecast(rows, season))
}
const reports = []
for (const [index, candidate] of candidates.entries()) {
  if (onlyPolicy !== undefined && index !== Number(onlyPolicy)) continue
  const evaluated = evaluatePowerPolicies({
    teams,
    games: candidate.fcs ? games : games.filter(isFbsGame),
    testSeasons,
    personnel,
    rosterFits,
    rosterContexts: allContexts,
    reconstructEvidence: true,
    policies: [candidate.policy],
    onProgress: (version) => console.log(`Evaluating ${index}: ${version}`),
  })
  const raw = evaluated.reports[0],
    cutSeasons = testSeasons.slice(1)
  const baseline = raw.forecasts.filter((f) => cutSeasons.includes(f.season)),
    calibrated = [],
    fits = []
  for (const season of cutSeasons) {
    const fit = fitPowerCalibration(
      raw.forecasts.filter((f) => f.season < season),
      season,
    )
    fits.push({ season, ...fit })
    calibrated.push(
      ...raw.forecasts
        .filter((f) => f.season === season)
        .map((f) => calibrateForecast(f, fit)),
    )
  }
  const report = (forecasts, version) => {
    const evaluation = evaluateForecasts(forecasts)
    return {
      modelVersion: version,
      evaluation,
      folds: Object.entries(evaluation.bySeason).map(([season, m]) => ({
        ...m,
        season: Number(season),
      })),
      forecasts,
    }
  }
  reports.push({
    policy: candidate.policy,
    fullFcs: candidate.fcs,
    raw: report(baseline, raw.modelVersion),
    calibrated: report(calibrated, raw.modelVersion + '-calibrated'),
    fits,
    finalCalibration: fitPowerCalibration(
      raw.forecasts,
      Math.max(...testSeasons) + 1,
    ),
  })
}
const all = reports.flatMap((r) => [r.raw, r.calibrated])
const output = {
  rosterFits: Object.fromEntries(rosterFits),
  sourceSha256: createHash('sha256').update(buffer).digest('hex'),
  reconstruction: true,
  personnelReconstruction: true,
  trainingSeasons: [testSeasons[0]],
  testSeasons: testSeasons.slice(1),
  reports,
  selection: all.length ? chooseChampion(all[0], all.slice(1)) : null,
}
await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', {
  flag: 'wx',
})
console.log(
  JSON.stringify({
    outputPath,
    testSeasons: output.testSeasons,
    reports: reports.map((r) => ({
      version: r.policy.version,
      raw: r.raw.evaluation.overall.marginMae,
      calibrated: r.calibrated.evaluation.overall.marginMae,
      brier: r.calibrated.evaluation.overall.brier,
    })),
  }),
)
