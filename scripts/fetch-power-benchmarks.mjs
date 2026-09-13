import { writeFile } from 'node:fs/promises'

const [directory, start = '2017', end = '2025'] = process.argv.slice(2)
if (!directory || !process.env.CFBD_API_KEY)
  throw new Error(
    'Provide an existing output directory and CFBD_API_KEY through the environment.',
  )
async function get(endpoint) {
  const r = await fetch('https://api.collegefootballdata.com' + endpoint, {
    headers: { Authorization: `Bearer ${process.env.CFBD_API_KEY}` },
  })
  if (!r.ok) throw new Error(`Benchmark request failed (${r.status}).`)
  const data = await r.json()
  if (!Array.isArray(data)) throw new Error('Invalid benchmark response')
  return data
}
if (
  ![Number(start), Number(end)].every(Number.isInteger) ||
  Number(start) > Number(end)
)
  throw new Error('Invalid season range')
for (let season = Number(start); season <= Number(end); season++) {
  if (
    !Number.isInteger(season) ||
    season < 2000 ||
    season > new Date().getUTCFullYear()
  )
    throw new Error('Invalid season')
  const rows = await get(`/lines?year=${season}&seasonType=both`),
    observedAt = Date.now()
  const data = rows.map((r) => ({
    id: r.id,
    season: r.season,
    week: r.week,
    startDate: r.startDate,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    lines: r.lines.map((l) => ({
      provider: l.provider,
      spread: l.spread,
      spreadOpen: l.spreadOpen,
      homeMoneyline: l.homeMoneyline,
      awayMoneyline: l.awayMoneyline,
    })),
  }))
  await writeFile(
    `${directory}/market-${season}.json`,
    JSON.stringify({
      source: 'CFBD /lines',
      observedAt,
      season,
      timing:
        'Historical opening and archived spreads; no quote timestamps supplied.',
      rows: data,
    }),
    { flag: 'wx' },
  )
  console.log(JSON.stringify({ season, games: data.length }))
}
const season = new Date().getUTCFullYear(),
  rows = await get(`/ratings/sp?year=${season}`),
  observedAt = Date.now()
const teams = rows.filter(
  (r) =>
    Number.isInteger(r.ranking) && r.ranking > 0 && Number.isFinite(r.rating),
)
await writeFile(
  `${directory}/sp-${season}-${observedAt}.json`,
  JSON.stringify({
    source: 'CFBD /ratings/sp',
    observedAt,
    season,
    timing: 'Observed snapshot; usable only for games after this timestamp.',
    rows: teams.map((r) => ({
      team: r.team,
      rating: r.rating,
      ranking: r.ranking,
    })),
  }),
  { flag: 'wx' },
)
console.log(JSON.stringify({ spTeams: teams.length, observedAt }))
