import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hockeySeasonAt,
  npiTeamKey,
  parseNpiPage,
} from '../convex/hockeyNpiModel.ts'

function page() {
  return `<title>2027 NCAA Tournament NPI (NCAA Percentage Index)</title><table><thead><tr><th>NPI</th></tr></thead><tbody>${Array.from({ length: 40 }, (_, i) => `<tr><td>${i + 1}</td><td><a href="/ratings/npi.template.teamdetail.php?tid=${i + 1}&amp;w=">${i === 30 ? 'Michigan' : `Team ${i + 1}`}</a></td><td>* 55.20</td><td>1-0-0</td><td>1.00</td><td>0.00</td></tr>`).join('')}</tbody></table>`
}

test('NPI parser validates season, complete table, unique teams, and footnotes', () => {
  const teams = parseNpiPage(page(), 2026)
  assert.equal(teams.length, 40)
  assert.equal(teams[30].teamKey, 'michigan')
  assert.equal(teams[30].npi, 55.2)
  for (const html of [
    page().replace('</tbody>', ''),
    page().replace('tid=1&', 'tid=2&'),
    page().replace('>Michigan<', '>Other school<'),
    page().replace('* 55.20', '101'),
    page().replace('<td>40</td>', '<td>39</td>'),
  ])
    assert.throws(() => parseNpiPage(html, 2026))
  assert.throws(() => parseNpiPage(page(), 2025))
})

test('NPI matching uses explicit school aliases and preserves distinct teams', () => {
  for (const [a, b] of [
    ['Mass.-Lowell', 'UMass Lowell'],
    ['Massachusetts', 'UMass'],
    ['Connecticut', 'UConn'],
    ['Miami', 'Miami (Ohio)'],
    ['Lake Superior', 'Lake Superior State'],
    ['#3/4 Michigan State', 'Michigan State'],
  ])
    assert.equal(npiTeamKey(a), npiTeamKey(b))
  assert.notEqual(npiTeamKey('Michigan'), npiTeamKey('Michigan State'))
  assert.notEqual(npiTeamKey('Alaska'), npiTeamKey('Alaska Anchorage'))
})

test('hockey seasons and archive boundaries use the starting year', () => {
  assert.equal(hockeySeasonAt(Date.parse('2027-06-30T23:59:59Z')), 2026)
  assert.equal(hockeySeasonAt(Date.parse('2027-07-01T00:00:00Z')), 2027)
})
