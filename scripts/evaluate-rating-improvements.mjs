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
    'Usage: node scripts/evaluate-rating-improvements.mjs <enriched-data.json> <new-report.json> [policy-index]',
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
// Freeze the incumbent: future releases must not silently change this comparison.
const base = {
  version: 'v3-fbs-feed',
  historySeasons: 5,
  priorGames: 4,
  transitionPriorGames: 2,
  seasonRetention: 1,
  fullWeightResults: true,
  divisionAdjustment: true,
  halfLifeDays: null,
  turnoverSensitive: false,
  efficiencyWeight: 0,
  offensiveContinuity: false,
}
const candidates = [
  { policy: base, fcs: false },
  { policy: { ...base, version: 'full-fcs' }, fcs: true },
  {
    policy: { ...base, version: 'fixed-home', fixedHomeField: 2.5 },
    fcs: true,
  },
  {
    policy: {
      ...base,
      version: 'efficiency-20',
      fixedHomeField: 2.5,
      efficiencyWeight: 0.2,
    },
    fcs: true,
  },
  {
    policy: {
      ...base,
      version: 'efficiency-continuity',
      fixedHomeField: 2.5,
      efficiencyWeight: 0.2,
      offensiveContinuity: true,
    },
    fcs: true,
  },
  {
    policy: {
      ...base,
      version: 'efficiency-only',
      fixedHomeField: 2.5,
      efficiencyWeight: 1,
    },
    fcs: true,
  },
]
const reports = []
for (const [index, candidate] of candidates.entries()) {
  if (onlyPolicy !== undefined && index !== Number(onlyPolicy)) continue
  const evaluated = evaluatePowerPolicies({
    teams,
    games: candidate.fcs ? games : games.filter(isFbsGame),
    testSeasons,
    personnel,
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
