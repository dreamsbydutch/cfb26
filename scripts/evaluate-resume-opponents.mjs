import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildResumeRatingEdition } from '../convex/ratingSystem.ts'

const [directory, output] = process.argv.slice(2)
if (!directory || !output)
  throw new Error(
    'Usage: node --experimental-strip-types scripts/evaluate-resume-opponents.mjs <snapshot-table-directory> <new-report.json>',
  )

const readTable = async (name) =>
  (await readFile(resolve(directory, `${name}.jsonl`), 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
const [editions, snapshots, storedGames] = await Promise.all(
  ['ratingEditions', 'teamRatingSnapshots', 'collegeGames'].map(readTable),
)
const edition = editions
  .filter(
    (e) =>
      e.season === 2026 &&
      e.resumeVisible &&
      e.editionType !== 'research' &&
      e.resumeModelVersion === 'cfb26-resume-v5',
  )
  .sort((a, b) => b.cutoffAt - a.cutoffAt || b.generatedAt - a.generatedAt)[0]
if (!edition)
  throw new Error('Snapshot has no published 2026 Resume v5 edition.')
const ratings = snapshots
  .filter((r) => r.editionId === edition._id)
  .map((r) => ({
    teamId: r.programId,
    name: r.sourceProgramName,
    classification: r.classification,
    published: r.published,
    power: r.power,
    rank: r.powerRank,
    priorWeight: r.priorWeight,
  }))
const games = storedGames
  .filter(
    (g) =>
      g.season === 2026 &&
      g.completed &&
      Number.isFinite(g.homePoints) &&
      Number.isFinite(g.awayPoints) &&
      g.startTime < edition.cutoffAt,
  )
  .map((g) => ({
    id: String(g.sourceGameId),
    homeTeamId: g.homeProgramId,
    awayTeamId: g.awayProgramId,
    homePoints: g.homePoints,
    awayPoints: g.awayPoints,
    completed: true,
    kickoffAt: g.startTime,
    neutralSite: g.neutralSite,
    overtimePeriods: Math.max(
      (g.homeLineScores?.length ?? 4) - 4,
      (g.awayLineScores?.length ?? 4) - 4,
      0,
    ),
    season: g.season,
    week: g.week,
    ratingEvidence: g.ratingEvidence,
  }))
const input = {
  games,
  week: edition.week,
  powerEdition: { season: 2026, cutoffAt: edition.cutoffAt, ratings },
}
// Pin the shipped baseline. Resolve its TS dependencies without changing any files.
const baselineCommit = '486722f2dc7abf8ebce876eeb78a516b03db487b'
const source = execFileSync(
  'git',
  ['show', `${baselineCommit}:convex/ratingSystem.ts`],
  { encoding: 'utf8' },
)
const root = pathToFileURL(resolve('convex/ratingSystem.ts'))
const compiled = stripTypeScriptTypes(source).replace(
  /from\s+(['"])(\.[^'"]+)\1/g,
  (_, quote, specifier) =>
    `from ${quote}${new URL(specifier, root).href}${quote}`,
)
const baseline = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
)
const before = baseline.buildResumeRatingEdition(input)
const after = buildResumeRatingEdition(input)
const prior = new Map(before.ratings.map((r) => [r.teamId, r]))
const rows = after.ratings.map((r) => ({
  team: r.name,
  wins: r.actualWins,
  beforeRank: prior.get(r.teamId).resumeRank,
  afterRank: r.resumeRank,
  beforeScore: prior.get(r.teamId).resume,
  afterScore: r.resume,
  scoreChange:
    Math.round((r.resume - prior.get(r.teamId).resume) * 1000) / 1000,
}))
const report = {
  scope:
    'Isolated opponent-strength policy replay. Program prior and own-history bonus are disabled in BOTH runs; these are not exact hosted rankings or a prediction-accuracy claim.',
  baselineCommit,
  baselineModel: before.modelVersion,
  candidateModel: after.modelVersion,
  candidateSourceSha256: createHash('sha256')
    .update(await readFile(root))
    .digest('hex'),
  cutoffAt: edition.cutoffAt,
  week: edition.week,
  games: games.length,
  teams: rows.length,
  inputSha256: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
  maximumRankMove: Math.max(
    ...rows.map((r) => Math.abs(r.afterRank - r.beforeRank)),
  ),
  meanAbsoluteRankMove:
    rows.reduce((sum, r) => sum + Math.abs(r.afterRank - r.beforeRank), 0) /
    rows.length,
  rows,
}
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
console.log(
  JSON.stringify(
    {
      scope: report.scope,
      games: report.games,
      teams: report.teams,
      maximumRankMove: report.maximumRankMove,
      meanAbsoluteRankMove: report.meanAbsoluteRankMove,
      top: rows.slice(0, 15),
    },
    null,
    2,
  ),
)
