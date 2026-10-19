import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { ConvexHttpClient } from 'convex/browser'
import {
  hockeyPlayerKey,
  validateHockeyDraft,
} from '../convex/hockeyDraftModel.ts'

const [file, deployment, flag] = process.argv.slice(2)
if (
  !file ||
  !['adjoining-opossum-710', 'doting-chipmunk-7'].includes(deployment) ||
  (flag && flag !== '--apply')
)
  throw Error(
    'Usage: import-hockey-drafts.mjs <reviewed.json> <deployment-name> [--apply]',
  )
const input = JSON.parse(await readFile(file, 'utf8'))
if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > 150)
  throw Error('Expected 1-150 reviewed selections.')
const c = new ConvexHttpClient(`https://${deployment}.convex.cloud`)
const before = []
for (let season = 2005; season <= 2026; season++)
  before.push({
    season,
    ...(await c.query('teamRosters:list', { sport: 'hockey', season })),
  })
const entries = before.flatMap((row) => row.entries)
const seen = new Set()
// Resolve IDs on the actual target; prepared IDs from another deployment are never reused.
const rows = input.rows.map(({ draft }) => {
  validateHockeyDraft(draft)
  const key = `${draft.year}:${draft.overallPick}`
  if (seen.has(key)) throw Error('Duplicate reviewed pick.')
  seen.add(key)
  const matches = entries.filter(
    (player) =>
      hockeyPlayerKey(String(player.values.name ?? '')) ===
      hockeyPlayerKey(draft.playerName),
  )
  if (!matches.length)
    throw Error(`No saved hockey player: ${draft.playerName}`)
  return { draft, rosterIds: matches.map((player) => player._id) }
})
console.log(
  JSON.stringify({
    deployment,
    mode: flag === '--apply' ? 'apply' : 'dry-run',
    selections: rows.length,
    matchedRosterEntries: rows.reduce(
      (sum, row) => sum + row.rosterIds.length,
      0,
    ),
  }),
)
if (flag === '--apply') {
  const results = []
  for (let i = 0; i < rows.length; i += 10) {
    const result = spawnSync(
      process.execPath,
      [
        resolve('node_modules/convex/bin/main.js'),
        'run',
        'hockeyDrafts:importMatched',
        JSON.stringify({ rows: rows.slice(i, i + 10) }),
        '--deployment',
        deployment,
      ],
      { encoding: 'utf8', windowsHide: true },
    )
    if (result.status !== 0)
      throw Error(`Import stopped at batch ${i / 10 + 1}: ${result.stderr}`)
    results.push(JSON.parse(result.stdout))
  }
  let appearances = 0
  for (const previous of before) {
    const after = await c.query('teamRosters:list', {
      sport: 'hockey',
      season: previous.season,
    })
    assert.deepEqual(
      after,
      { revision: previous.revision, entries: previous.entries },
      'Roster fields/revision changed',
    )
    const drafts = await c.query('hockeyDrafts:forSeason', {
      season: previous.season,
    })
    for (const row of rows) {
      const key = hockeyPlayerKey(row.draft.playerName)
      const count = previous.entries.filter(
        (entry) => hockeyPlayerKey(String(entry.values.name)) === key,
      ).length
      if (!count) continue
      assert.ok(
        drafts
          .find((player) => player.playerKey === key)
          ?.selections.some((selection) =>
            Object.entries(row.draft).every(
              ([field, value]) => selection[field] === value,
            ),
          ),
        `Read-back mismatch: ${row.draft.playerName}, ${previous.season}`,
      )
      appearances += count
    }
  }
  const receipt = {
    deployment,
    results,
    appearances,
    rosterFieldsAndRevisionsUnchanged: true,
  }
  await writeFile(
    file + `.${deployment}.${Date.now()}.receipt.json`,
    JSON.stringify(receipt, null, 2),
    { flag: 'wx' },
  )
  console.log(JSON.stringify(receipt))
}
