import { readFile, writeFile } from 'node:fs/promises'
import { evaluatePowerPolicies } from '../convex/powerResearch.ts'

const [inputPath, outputPath] = process.argv.slice(2)
if (!inputPath || !outputPath)
  throw new Error(
    'Usage: npm run ratings:evaluate -- <model-data.json> <new-report.json>',
  )
const buffer = await readFile(inputPath)
const data = JSON.parse(
  buffer[0] === 255
    ? buffer.toString('utf16le').slice(1)
    : buffer.toString('utf8').replace(/^\uFEFF/, ''),
)
if (!Array.isArray(data.programs) || !Array.isArray(data.games))
  throw new Error('Expected an exported ratings:loadPowerModelData object.')
const seasons = [...new Set(data.games.map((game) => game.season))].sort(
  (a, b) => a - b,
)
const classification = new Map()
for (const game of data.games) {
  classification.set(game.homeProgramId, game.homeClassification)
  classification.set(game.awayProgramId, game.awayClassification)
}
const teams = data.programs
  .filter((program) => classification.has(program._id))
  .map((program) => ({
    id: program._id,
    name: program.name,
    classification: classification.get(program._id) === 'fbs' ? 'fbs' : 'fcs',
  }))
const games = data.games
  .filter(
    (game) =>
      game.completed &&
      Number.isFinite(game.homePoints) &&
      Number.isFinite(game.awayPoints),
  )
  .map((game) => ({
    homeClassification: game.homeClassification,
    awayClassification: game.awayClassification,
    seasonType: game.seasonType,
    id: String(game.sourceGameId),
    homeTeamId: game.homeProgramId,
    awayTeamId: game.awayProgramId,
    homePoints: game.homePoints,
    awayPoints: game.awayPoints,
    season: game.season,
    week: game.week,
    kickoffAt: game.startTime,
    completed: true,
    neutralSite: game.neutralSite,
    overtimePeriods: Math.max(
      (game.homeLineScores?.length ?? 4) - 4,
      (game.awayLineScores?.length ?? 4) - 4,
      0,
    ),
  }))
// Reserve four full seasons of history; never evaluate an incomplete season.
const testSeasons = seasons
  .slice(4)
  .filter((season) =>
    data.games
      .filter((game) => game.season === season)
      .every((game) => game.completed),
  )
const report =
  testSeasons.length === 0
    ? {
        reconstruction: true,
        promoted: false,
        availableSeasons: seasons,
        reason:
          'No complete held-out season remains after reserving four seasons of training history. Eight complete held-out seasons are required for promotion.',
      }
    : evaluatePowerPolicies({
        teams,
        games,
        testSeasons,
        onProgress: (version) =>
          console.log(`Evaluating ${version} across ${testSeasons.join(', ')}`),
      })
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', {
  flag: 'wx',
})
console.log(
  JSON.stringify({
    outputPath,
    availableSeasons: seasons,
    testSeasons,
    promoted:
      'selection' in report &&
      report.selection.champion.modelVersion !== 'cfb26-power-v1',
  }),
)
