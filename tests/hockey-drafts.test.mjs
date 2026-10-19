import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hockeyPlayerKey,
  parseMichiganDrafts,
  validateHockeyDraft,
} from '../convex/hockeyDraftModel.ts'
import {
  teamDefinitions,
  validateTeamValues,
} from '../convex/teamRosterFields.ts'

const source =
  'https://mgoblue.com/news/2008/6/27/michigan_players_selected_in_the_nhl_draft'
function page() {
  return `<div id="storyPageContentBody"><p>* Selected prior to attending Michigan</p><table><tbody><tr><td colspan="3">2026 NHL Entry Draft</td></tr>${Array.from({ length: 100 }, (_, i) => `<tr><td>Player ${i + 1}${i === 0 ? '*' : ''}</td><td>Draft Team</td><td>Rd. ${Math.floor(i / 32) + 1} (${i + 1})</td></tr>`).join('')}</tbody></table></div>`
}

test('Michigan draft extraction isolates article rows, year headings and prior-attendance markers', () => {
  const picks = parseMichiganDrafts(page())
  assert.equal(picks.length, 100)
  assert.deepEqual(picks[0], {
    playerName: 'Player 1',
    year: 2026,
    nhlTeam: 'Draft Team',
    round: 1,
    overallPick: 1,
    priorToMichigan: true,
  })
  assert.equal(picks[1].priorToMichigan, false)
  for (const html of [
    page().replace('</table>', ''),
    page().replace('Rd. 1 (1)', 'Round unknown'),
    page().replace('2026 NHL Entry Draft', 'Unknown draft'),
    page().replace('Rd. 1 (2)', 'Rd. 1 (1)'),
  ])
    assert.throws(() => parseMichiganDrafts(html))
})

test('draft matching accepts reviewed aliases but never joins siblings or unrelated names', () => {
  for (const [a, b] of [
    ['Joe Cecconi', 'Joseph Cecconi'],
    ["Cristoval 'Boo' Nieves", 'Cristoval Nieves'],
    ['Boo Nieves', 'Cristoval Nieves'],
    ['Nicholas Moldenhauer', 'Nick Moldenhauer'],
    ['J.T. Compher', 'JT Compher'],
  ])
    assert.equal(hockeyPlayerKey(a), hockeyPlayerKey(b))
  assert.notEqual(
    hockeyPlayerKey('Shawn Hunwick'),
    hockeyPlayerKey('Matt Hunwick'),
  )
  assert.notEqual(hockeyPlayerKey('Tyler Duke'), hockeyPlayerKey('Dylan Duke'))
})

test('draft validation rejects invalid picks and untrusted sources', () => {
  const draft = {
    playerName: 'Player',
    year: 2025,
    round: 7,
    overallPick: 223,
    nhlTeam: 'Edmonton Oilers',
    priorToMichigan: null,
    sourceUrl: source,
    sourceSha256: 'a'.repeat(64),
  }
  validateHockeyDraft(draft)
  validateHockeyDraft({
    ...draft,
    sourceUrl: 'https://records.nhl.com/site/api/draft?cayenneExp=id%3D19791',
  })
  for (const change of [
    { round: 8 },
    { overallPick: 0 },
    { overallPick: NaN },
    { year: 2025.5 },
    { sourceUrl: 'https://example.com' },
    {
      sourceUrl:
        'https://records.nhl.com.evil.test/site/api/draft?cayenneExp=id=1',
    },
    { sourceSha256: 'invalid' },
  ])
    assert.throws(() => validateHockeyDraft({ ...draft, ...change }))
})

test('hockey removes recruiting inputs while accepting older saved null columns; basketball retains recruiting', () => {
  assert.ok(
    !teamDefinitions.hockey.columns.some(
      (column) => column.key === 'recruitRank',
    ),
  )
  assert.ok(
    teamDefinitions.basketball.columns.some(
      (column) => column.key === 'recruitRank',
    ),
  )
  const result = validateTeamValues('hockey', {
    name: 'Player',
    recruitRank: null,
    recruitRating: null,
  })
  assert.ok(!Object.hasOwn(result, 'recruitRank'))
  assert.throws(() =>
    validateTeamValues('hockey', { name: 'Player', recruitRank: 5 }),
  )
  assert.equal(
    validateTeamValues('basketball', { name: 'Player', recruitRank: 5 })
      .recruitRank,
    5,
  )
})
