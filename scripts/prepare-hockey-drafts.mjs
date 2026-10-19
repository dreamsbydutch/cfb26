import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import {
  parseMichiganDrafts,
  hockeyPlayerKey,
} from '../convex/hockeyDraftModel.ts'
const [dir, output] = process.argv.slice(2)
if (!dir || !output)
  throw Error(
    'Usage: prepare-hockey-drafts.mjs <source-directory> <new-output.json>',
  )
const html = await readFile(dir + '/source.html', 'utf8')
const page = parseMichiganDrafts(html)
const nhlRaw = await readFile(dir + '/nhl-draft-records.json', 'utf8')
const records = JSON.parse(nhlRaw).data
const rosters = JSON.parse(await readFile(dir + '/rosters-before.json', 'utf8'))
const entries = rosters.flatMap((r) => r.entries)
const groups = new Map()
for (const e of entries) {
  const k = hockeyPlayerKey(e.values.name)
  groups.set(k, [...(groups.get(k) ?? []), e])
}
const nhlTeams = JSON.parse(await readFile(dir + '/nhl-teams.json', 'utf8'))
if (records.length !== JSON.parse(nhlRaw).total)
  throw Error('Incomplete NHL draft records.')
const prepared = [],
  conflicts = []
for (const [key, players] of groups) {
  const first = Math.min(...players.map((p) => p.season)),
    last = Math.max(...players.map((p) => p.season))
  const mg = page.filter((p) => hockeyPlayerKey(p.playerName) === key)
  const nh = records.filter(
    (p) =>
      hockeyPlayerKey(p.playerName) === key &&
      p.draftYear >= first - 8 &&
      p.draftYear <= last + 1 &&
      p.supplementalDraft === 'N',
  )
  if (mg.length > 1 || nh.length > 1) throw Error('Ambiguous ' + key)
  if (
    mg.length &&
    nh.length &&
    (mg[0].year !== nh[0].draftYear ||
      mg[0].round !== nh[0].roundNumber ||
      mg[0].overallPick !== nh[0].overallPickNumber)
  )
    conflicts.push({ name: key, mg: mg[0], nhl: nh[0] })
  const correction =
    mg.length &&
    nh.length &&
    (mg[0].year !== nh[0].draftYear ||
      mg[0].round !== nh[0].roundNumber ||
      mg[0].overallPick !== nh[0].overallPickNumber)
  if (
    correction &&
    !(
      (key === 'leemoffie' &&
        nh[0].draftYear === 2010 &&
        nh[0].roundNumber === 7 &&
        nh[0].overallPickNumber === 188) ||
      (key === 'aidanpark' &&
        nh[0].draftYear === 2025 &&
        nh[0].roundNumber === 7 &&
        nh[0].overallPickNumber === 223)
    )
  )
    throw Error('Unreviewed source disagreement: ' + key)
  let draft
  if (mg.length && !correction) {
    draft = {
      ...mg[0],
      sourceUrl:
        'https://mgoblue.com/news/2008/6/27/michigan_players_selected_in_the_nhl_draft',
      sourceSha256: createHash('sha256').update(html).digest('hex'),
    }
  } else if (nh.length) {
    const n = nh[0]
    const team = nhlTeams.data.find((t) => t.id === n.draftedByTeamId)
    if (!team) throw Error('Missing NHL team ' + n.triCode)
    draft = {
      playerName: players[0].values.name,
      year: n.draftYear,
      round: n.roundNumber,
      overallPick: n.overallPickNumber,
      nhlTeam: team.fullName,
      priorToMichigan: null,
      sourceUrl:
        'https://records.nhl.com/site/api/draft?cayenneExp=id%3D' + n.id,
      sourceSha256: createHash('sha256')
        .update(JSON.stringify(n))
        .digest('hex'),
    }
  }
  if (draft) prepared.push({ draft, rosterIds: players.map((p) => p._id) })
}
const summary = {
  pageRows: page.length,
  matched: prepared.length,
  rosterInstances: prepared.reduce((sum, x) => sum + x.rosterIds.length, 0),
  nhlSourced: prepared.filter((p) =>
    p.draft.sourceUrl.includes('records.nhl.com'),
  ).length,
  corrections: conflicts.map((c) => ({
    name: c.name,
    michigan: { round: c.mg.round, pick: c.mg.overallPick },
    nhl: { round: c.nhl.roundNumber, pick: c.nhl.overallPickNumber },
  })),
}
await writeFile(output, JSON.stringify({ rows: prepared }, null, 2), {
  flag: 'wx',
})
await writeFile(output + '.audit.json', JSON.stringify(summary, null, 2), {
  flag: 'wx',
})
console.log(JSON.stringify(summary, null, 2))
