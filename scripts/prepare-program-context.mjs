import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { buildPowerRatingEdition } from '../convex/ratingSystem.ts'
import {
  PROGRAM_MODEL_VERSION,
  buildProgramRatings,
  acquisitionPercentiles,
  evidencePercentiles,
  developmentWithConversion,
} from '../convex/programRating.ts'
import { accomplishmentsFromGames } from '../convex/programAccomplishments.ts'
import { historicalNationalTitles } from '../convex/programHonorsHistory.ts'
import {
  fitProgramForecast,
  programForecast,
} from '../convex/programContext.ts'

const [enrichedPath, gamesPath, draftsPath, outputPath] = process.argv.slice(2)
const sustainedSuccess = !process.argv.includes('--program-v4')
if (!outputPath)
  throw new Error(
    'Usage: node scripts/prepare-program-context.mjs <enriched.json> <games.jsonl> <drafts.jsonl> <new-output.json> [--program-v4]',
  )
const buffers = await Promise.all(
  [enrichedPath, gamesPath, draftsPath].map((path) => readFile(path)),
)
const data = JSON.parse(buffers[0]),
  archived = buffers[1].toString().trim().split(/\r?\n/).map(JSON.parse),
  drafts = buffers[2].toString().trim().split(/\r?\n/).map(JSON.parse)
const byId = new Map(archived.map((game) => [String(game.sourceGameId), game]))
for (const game of data.games) byId.set(String(game.sourceGameId), game)
const games = [...byId.values()].map((g) => ({
  ...g,
  id: String(g.sourceGameId),
  homeTeamId: g.homeProgramId,
  awayTeamId: g.awayProgramId,
  kickoffAt: g.startTime,
  overtimePeriods: Math.max(
    0,
    (g.homeLineScores?.length ?? 4) - 4,
    (g.awayLineScores?.length ?? 4) - 4,
  ),
}))
const teams = data.programs.map((p) => ({ id: p._id, name: p.name }))
const evidence = [],
  training = [],
  scores = [],
  fits = [],
  talentBySeason = new Map()
for (let season = 2000; season <= 2026; season++) {
  const cutoffAt = Date.UTC(season, 7, 1)
  const schedule = games.filter((g) => g.season === season)
  const field = new Set(
    schedule.flatMap((g) => [
      ...(g.homeClassification === 'fbs' ? [g.homeTeamId] : []),
      ...(g.awayClassification === 'fbs' ? [g.awayTeamId] : []),
    ]),
  )
  const honors = [
    ...accomplishmentsFromGames(
      games.filter((g) => g.season < season),
      cutoffAt,
    ),
    ...historicalNationalTitles(teams, season - 1, cutoffAt),
  ]
  const program = buildProgramRatings({
    sustainedSuccess,
    season,
    teams: [...field].map((teamId) => ({ teamId, published: true })),
    evidence: evidence.filter((row) => row.season < season),
    accomplishments: honors,
  })
  const fit =
    training.length >= 200 ? fitProgramForecast(training, season) : undefined
  if (fit) fits.push({ season, ...fit })
  for (const row of program) {
    const context = {
      programRating: row.programRating,
      programSeasons: row.programSeasons,
      historyThroughSeason: season - 1,
    }
    scores.push({
      season,
      teamId: row.teamId,
      ...context,
      power: programForecast(context, fit, season) ?? 0,
    })
  }
  if (season === 2026) continue // Incomplete current season can never become a training target.
  const participants = new Set(
    schedule.flatMap((g) => [g.homeTeamId, g.awayTeamId]),
  )
  const earned = buildPowerRatingEdition({
    season,
    week: 30,
    cutoffAt: Date.UTC(season + 1, 7, 1),
    teams: teams
      .filter((t) => participants.has(t.id))
      .map((t) => ({ ...t, classification: field.has(t.id) ? 'fbs' : 'fcs' })),
    games: schedule.map((g) => ({ ...g, ratingEvidence: undefined })),
  })
  const profiles = data.profiles
    .filter((p) => p.season === season)
    .map((p) => ({ ...p, teamId: p.programId }))
  const acquisition = acquisitionPercentiles(profiles, field)
  const talent = acquisitionPercentiles(
    profiles.map((p) => ({ ...p, recruitingPoints: null })),
    field,
  )
  talentBySeason.set(season, talent)
  const picks = drafts.filter((p) => p.year === season)
  const draftValues = new Map()
  if (picks.length >= 150) {
    for (const id of field) draftValues.set(id, 0)
    for (const pick of picks)
      if (field.has(pick.programId))
        draftValues.set(
          pick.programId,
          (draftValues.get(pick.programId) ?? 0) +
            1 +
            (8 - Math.min(pick.round, 7)) / 7,
        )
  }
  const development = evidencePercentiles(draftValues)
  for (const row of earned.ratings) {
    const prior = program.find((p) => p.teamId === row.teamId)
    if (row.published && row.gamesPlayed >= 8 && prior?.programSeasons > 0)
      training.push({
        season,
        programRating: prior.programRating,
        target: row.power,
      })
    const output = development.get(row.teamId)
    const cohort = [1, 2, 3].map((age) =>
      talentBySeason.get(season - age)?.get(row.teamId),
    )
    evidence.push({
      teamId: row.teamId,
      season,
      games: row.gamesPlayed,
      performance: 100 / (1 + Math.exp(-row.power / 10)),
      acquisition: acquisition.get(row.teamId),
      development:
        output === undefined
          ? undefined
          : developmentWithConversion(
              output,
              cohort.every((value) => value !== undefined)
                ? cohort.reduce((a, b) => a + b, 0) / 3
                : undefined,
            ),
    })
  }
}
await writeFile(
  outputPath,
  JSON.stringify(
    {
      sourceSha256: createHash('sha256').update(buffers[0]).digest('hex'),
      inputs: buffers.map((b) => createHash('sha256').update(b).digest('hex')),
      reconstruction: true,
      programModelVersion: sustainedSuccess
        ? PROGRAM_MODEL_VERSION
        : 'cfb26-program-v4',
      description:
        'Preseason Program built only from preceding seasons; linear strength mapping trained on earlier-season outcomes. Historical personnel availability is reconstructed; incomplete conference title coverage remains.',
      scores,
      fits,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
)
console.log(
  JSON.stringify({
    outputPath,
    teamSeasons: scores.length,
    fits: fits.length,
    finalFit: fits.at(-1),
  }),
)
