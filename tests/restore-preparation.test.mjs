import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const datasets = {
  players: [{ _id: 'player-1', canonicalName: 'Test Player' }],
  commitments: [],
  rosterStints: [],
  playerSeasons: [],
  evaluations: [],
  movementEvents: [],
  draftOutcomes: [],
  playerGames: [],
  nflIdentities: [],
  nflWeeklyRosters: [],
  nflPlayerGames: [],
  nflSeasonSummaries: [],
  providerIdentities: [],
  seasonRules: [],
  unresolvedMatches: [],
}

test('restore preparation verifies the fingerprint and emits ordered JSONL', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cfb26-restore-'))
  const backupPath = resolve(directory, 'backup.json')
  const outputPath = resolve(directory, 'prepared')
  const core = { schemaVersion: '2', datasets }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(core))
    .digest('hex')
  await writeFile(
    backupPath,
    JSON.stringify({
      ...core,
      exportedAt: new Date(0).toISOString(),
      fingerprint,
    }),
  )

  try {
    const result = spawnSync(
      process.execPath,
      ['scripts/prepare-michigan-restore.mjs', backupPath, outputPath],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(
      JSON.parse(await readFile(resolve(outputPath, 'players.jsonl'), 'utf8')),
      datasets.players[0],
    )
    const manifest = JSON.parse(
      await readFile(resolve(outputPath, 'restore-manifest.json'), 'utf8'),
    )
    assert.equal(manifest.fingerprint, fingerprint)
    assert.equal(manifest.restoreOrder[0], 'players')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('restore preparation rejects a modified backup', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cfb26-restore-'))
  const backupPath = resolve(directory, 'backup.json')
  await writeFile(
    backupPath,
    JSON.stringify({ schemaVersion: '2', datasets, fingerprint: 'invalid' }),
  )

  try {
    const result = spawnSync(
      process.execPath,
      [
        'scripts/prepare-michigan-restore.mjs',
        backupPath,
        resolve(directory, 'out'),
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /fingerprint mismatch/i)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
