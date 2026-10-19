import type { Infer } from 'convex/values'
import type { npiTeam } from './hockeyNpiFields'

export const NPI_SOURCE = 'https://www.collegehockeynews.com/ratings/npi'
export type NpiTeam = Infer<typeof npiTeam>

const aliases: Record<string, string> = {
  alaska: 'alaskafairbanks',
  armywestpoint: 'army',
  connecticut: 'uconn',
  lakesuperior: 'lakesuperiorstate',
  liu: 'longisland',
  massachusetts: 'umass',
  umassamherst: 'umass',
  masslowell: 'umasslowell',
  massachusettslowell: 'umasslowell',
  miami: 'miamiohio',
  miamioh: 'miamiohio',
  nebraskaomaha: 'omaha',
  rensselaer: 'rpi',
  rensselaerpolytechnicinstitute: 'rpi',
  rochesterinstituteoftechnology: 'rit',
  saintcloudstate: 'stcloudstate',
  saintlawrence: 'stlawrence',
  saintthomas: 'stthomas',
  stthomasminn: 'stthomas',
}

export function npiTeamKey(team: string) {
  const key = team
    .replace(/^#(?:\d+|--)(?:\/#?(?:\d+|--))?\s+/, '')
    .replace(/\s*\((?:ex|#\d+)\)\s*$/i, '')
    .replace(/\bUniversity\b/gi, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return aliases[key] ?? key
}

function plain(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(
      /&(?:amp|nbsp|quot|apos|#39|#039);/g,
      (entity) =>
        ({
          '&amp;': '&',
          '&nbsp;': ' ',
          '&quot;': '"',
          '&apos;': "'",
          '&#39;': "'",
          '&#039;': "'",
        })[entity] ?? entity,
    )
    .replace(/\s+/g, ' ')
    .trim()
}

export function validateNpiTeams(teams: Array<NpiTeam>) {
  if (teams.length < 40 || teams.length > 100)
    throw new Error('NPI table must contain 40–100 ranked teams.')
  const ids = new Set<string>(),
    keys = new Set<string>(),
    ranks = new Set<number>()
  for (const team of teams) {
    if (
      !/^\d+$/.test(team.sourceTeamId) ||
      ids.has(team.sourceTeamId) ||
      keys.has(team.teamKey) ||
      ranks.has(team.rank)
    )
      throw new Error('NPI team identities and ranks must be unique.')
    if (
      !team.team.trim() ||
      team.team.length > 100 ||
      team.teamKey !== npiTeamKey(team.team) ||
      !Number.isInteger(team.rank) ||
      team.rank < 1 ||
      team.rank > teams.length ||
      !Number.isFinite(team.npi) ||
      team.npi < 0 ||
      team.npi > 100
    )
      throw new Error('Invalid NPI team, rank, or value.')
    ids.add(team.sourceTeamId)
    keys.add(team.teamKey)
    ranks.add(team.rank)
  }
  const michigan = teams.find((team) => team.sourceTeamId === '31')
  if (!michigan || michigan.teamKey !== 'michigan')
    throw new Error('Michigan NPI identity is missing or inconsistent.')
}

export function parseNpiPage(html: string, expectedSeason: number) {
  if (html.length > 2_000_000)
    throw new Error('NPI response exceeds the allowed size.')
  const year = html.match(
    /<title[^>]*>\s*(\d{4})\s+NCAA Tournament NPI\b/i,
  )?.[1]
  if (!year || Number(year) !== expectedSeason + 1)
    throw new Error('NPI page season does not match the active hockey season.')
  const table = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .find((candidate) => /<th[^>]*>\s*NPI\s*<\/th>/i.test(candidate))
  if (!table || !/<\/tbody>/i.test(table))
    throw new Error('Complete NPI table is missing.')
  const body = table.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? ''
  const teams: Array<NpiTeam> = []
  for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (cell) => cell[1],
    )
    if (cells.length !== 6) throw new Error('Incomplete NPI team row.')
    const sourceTeamId = cells[1].match(
      /href=["']\/ratings\/npi\.template\.teamdetail\.php\?tid=(\d+)(?:&|["'])/i,
    )?.[1]
    const name = plain(cells[1])
    const rank = plain(cells[0])
    const value = plain(cells[2]).replace(/^[*#\s]+|[*#\s]+$/g, '')
    if (!sourceTeamId || !/^\d+$/.test(rank) || !/^\d+(?:\.\d+)?$/.test(value))
      throw new Error('NPI team row format changed.')
    teams.push({
      sourceTeamId,
      team: name,
      teamKey: npiTeamKey(name),
      rank: Number(rank),
      npi: Number(value),
    })
  }
  validateNpiTeams(teams)
  return teams.sort((a, b) => a.rank - b.rank)
}

export function hockeySeasonAt(now: number) {
  const date = new Date(now)
  return date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0)
}

export function npiWeekStart(now: number) {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}
