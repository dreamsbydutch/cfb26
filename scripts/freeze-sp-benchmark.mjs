import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const [modelPath, snapshotPath, outputPath] = process.argv.slice(2)
if (!modelPath || !snapshotPath || !outputPath)
  throw new Error(
    'Usage: node scripts/freeze-sp-benchmark.mjs <model-data.json> <observed-SP-snapshot.json> <new-forecast-file.json>',
  )
const data = JSON.parse(await readFile(modelPath, 'utf8')),
  buffer = await readFile(snapshotPath),
  snapshot = JSON.parse(buffer)
if (!Number.isFinite(snapshot.observedAt) || snapshot.observedAt > Date.now())
  throw new Error('Invalid observation timestamp')
const ratings = new Map(
  snapshot.rows
    .filter(
      (r) =>
        Number.isFinite(r.rating) &&
        Number.isInteger(r.ranking) &&
        r.ranking > 0,
    )
    .map((r) => [r.team, r.rating]),
)
const games = data.games.filter(
  (g) =>
    g.season === snapshot.season &&
    g.seasonType === 'regular' &&
    g.week <= 4 &&
    !g.completed &&
    g.startTime > snapshot.observedAt &&
    g.homeClassification === 'fbs' &&
    g.awayClassification === 'fbs',
)
const forecasts = [],
  missing = []
for (const game of games) {
  const home = ratings.get(game.homeSourceName),
    away = ratings.get(game.awaySourceName)
  if (home === undefined || away === undefined) {
    missing.push(String(game.sourceGameId))
    continue
  }
  forecasts.push({
    gameId: String(game.sourceGameId),
    season: game.season,
    week: game.week,
    kickoffAt: game.startTime,
    observedAt: snapshot.observedAt,
    home: game.homeSourceName,
    away: game.awaySourceName,
    neutralSite: game.neutralSite,
    predictedMargin: home - away + (game.neutralSite ? 0 : 2.5),
  })
}
await writeFile(
  outputPath,
  JSON.stringify(
    {
      source: snapshot.source,
      sourceSha256: createHash('sha256').update(buffer).digest('hex'),
      observedAt: snapshot.observedAt,
      venueAssumption:
        'SP+ neutral rating difference plus a fixed 2.5-point home effect; these are derived benchmarks, not published Connelly game picks.',
      missing,
      forecasts,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
)
console.log(
  JSON.stringify({
    forecasts: forecasts.length,
    missing: missing.length,
    observedAt: snapshot.observedAt,
  }),
)
