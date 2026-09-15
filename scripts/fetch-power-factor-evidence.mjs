import { mkdir, readFile, writeFile } from 'node:fs/promises'

const [directory, start = '2013', end = '2025'] = process.argv.slice(2)
if (
  !directory ||
  !process.env.CFBD_API_KEY ||
  ![Number(start), Number(end)].every(Number.isInteger) ||
  Number(start) < 2000 ||
  Number(end) >= new Date().getUTCFullYear() ||
  Number(start) > Number(end)
)
  throw new Error(
    'Provide an output directory, completed season range, and CFBD_API_KEY through the environment.',
  )
await mkdir(directory, { recursive: true })
for (let season = Number(start); season <= Number(end); season++) {
  for (const [kind, endpoint] of [
    ['returning', `/player/returning?year=${season}`],
    ['advanced', `/stats/game/advanced?year=${season}&excludeGarbageTime=true`],
    ['drives', `/drives?year=${season}&seasonType=both`],
  ]) {
    const path = `${directory}/${kind}-${season}.json`
    try {
      const cached = JSON.parse(await readFile(path, 'utf8'))
      if (cached.endpoint !== endpoint || !Array.isArray(cached.rows))
        throw new Error('Invalid evidence cache.')
      console.log(
        JSON.stringify({
          season,
          kind,
          cached: true,
          rows: cached.rows.length,
        }),
      )
      continue
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }
    const response = await fetch(
      'https://api.collegefootballdata.com' + endpoint,
      {
        headers: { Authorization: `Bearer ${process.env.CFBD_API_KEY}` },
        signal: AbortSignal.timeout(120_000),
      },
    )
    if (!response.ok)
      throw new Error(
        `Factor evidence ${kind}/${season} failed (${response.status}).`,
      )
    const rows = await response.json()
    if (!Array.isArray(rows)) throw new Error('Expected factor evidence rows.')
    await writeFile(
      path,
      JSON.stringify({
        source: 'CFBD',
        endpoint,
        observedAt: Date.now(),
        season,
        timing:
          'Historical reconstruction fetched after the season, not a pregame snapshot.',
        rows,
      }) + '\n',
      { flag: 'wx' },
    )
    console.log(JSON.stringify({ season, kind, rows: rows.length }))
  }
}
