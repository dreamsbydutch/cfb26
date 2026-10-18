import { v } from 'convex/values'

export const teamSport = v.union(v.literal('basketball'), v.literal('hockey'))
export type TeamSport = 'basketball' | 'hockey'
export const teamValues = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.null()),
)
export type TeamValues = Record<string, string | number | null>
export type TeamColumn = {
  key: string
  label: string
  type?: 'number'
  options?: Array<string>
  max?: number
  integer?: boolean
}
const number = (
  key: string,
  label: string,
  max = 100000,
  integer = true,
): TeamColumn => ({ key, label, type: 'number', max, integer })
const common: Array<TeamColumn> = [
  { key: 'name', label: 'Player' },
  { key: 'jersey', label: '#' },
  {
    key: 'year',
    label: 'Year',
    options: ['FR', 'SO', 'JR', 'SR', '5TH', 'GR'],
  },
  {
    key: 'status',
    label: 'Status',
    options: ['Active', 'Injured', 'Inactive', 'Departed'],
  },
  number('height', 'Height (in)', 100, false),
  number('weight', 'Weight (lb)', 500, false),
  { key: 'hometown', label: 'Hometown' },
  { key: 'previousTeam', label: 'Previous school / team' },
  number('recruitRank', 'Recruit rank'),
  number('recruitRating', 'Recruit rating (0–1)', 1, false),
  number('games', 'GP', 100),
  number('starts', 'Starts', 100),
]
export const teamDefinitions = {
  basketball: {
    name: 'Men’s basketball',
    groups: [
      { name: 'Guards', positions: ['PG', 'SG', 'G'] },
      { name: 'Wings / forwards', positions: ['SF', 'PF', 'F', 'G/F'] },
      { name: 'Centers', positions: ['C', 'F/C'] },
    ],
    columns: [
      ...common,
      {
        key: 'position',
        label: 'Position',
        options: ['PG', 'SG', 'G', 'SF', 'PF', 'F', 'G/F', 'C', 'F/C'],
      },
      {
        key: 'role',
        label: 'Role',
        options: ['Starter', 'Rotation', 'Reserve'],
      },
      number('minutes', 'Minutes', 10000, false),
      number('points', 'Points'),
      number('rebounds', 'Rebounds'),
      number('assists', 'Assists'),
      number('steals', 'Steals'),
      number('blocks', 'Blocks'),
      number('turnovers', 'Turnovers'),
      number('fgPct', 'FG%', 100, false),
      number('threePct', '3P%', 100, false),
      number('ftPct', 'FT%', 100, false),
    ],
  },
  hockey: {
    name: 'Men’s hockey',
    groups: [
      { name: 'Forwards', positions: ['C', 'LW', 'RW', 'F'] },
      { name: 'Defensemen', positions: ['D'] },
      { name: 'Goalies', positions: ['G'] },
    ],
    columns: [
      ...common,
      {
        key: 'position',
        label: 'Position',
        options: ['C', 'LW', 'RW', 'F', 'D', 'G'],
      },
      { key: 'hand', label: 'Shoots / catches', options: ['L', 'R'] },
      {
        key: 'line',
        label: 'Line / pair',
        options: ['1', '2', '3', '4', 'Extra'],
      },
      number('goals', 'Goals'),
      number('assists', 'Assists'),
      number('shots', 'Shots'),
      number('pim', 'Penalty minutes'),
      number('goalieMinutes', 'Goalie minutes', 10000, false),
      number('saves', 'Saves'),
      number('goalsAgainst', 'Goals against'),
      number('wins', 'Wins', 100),
      number('shutouts', 'Shutouts', 100),
    ],
  },
} satisfies Record<
  TeamSport,
  {
    name: string
    groups: Array<{ name: string; positions: Array<string> }>
    columns: Array<TeamColumn>
  }
>

export function seasonLabel(season: number) {
  return `${season}–${String(season + 1).slice(-2)}`
}

export function validateTeamValues(
  sport: TeamSport,
  input: TeamValues,
): TeamValues {
  const columns: Array<TeamColumn> = teamDefinitions[sport].columns
  if (
    Object.keys(input).some(
      (key) => !columns.some((column) => column.key === key),
    )
  )
    throw new Error('Unknown roster column for this sport.')
  const result: TeamValues = {}
  for (const column of columns) {
    const raw = input[column.key] ?? null
    if (raw === null || String(raw).trim() === '') {
      result[column.key] = null
      continue
    }
    if (column.type === 'number') {
      const value = Number(raw)
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > (column.max ?? 100000) ||
        (column.integer && !Number.isInteger(value))
      )
        throw new Error(
          `${column.label}: enter a valid ${column.integer ? 'whole ' : ''}number from 0 to ${column.max}.`,
        )
      result[column.key] = value
    } else {
      const value = String(raw).trim()
      if (
        value.length > 160 ||
        (column.options && !column.options.includes(value))
      )
        throw new Error(`${column.label}: invalid value.`)
      result[column.key] = value
    }
  }
  if (!result.name) throw new Error('Player name is required.')
  if (
    result.games !== null &&
    result.starts !== null &&
    Number(result.starts) > Number(result.games)
  )
    throw new Error('Starts cannot exceed games played.')
  if (
    sport === 'hockey' &&
    result.position !== 'G' &&
    ['goalieMinutes', 'saves', 'goalsAgainst', 'wins', 'shutouts'].some(
      (key) => result[key] !== null,
    )
  )
    throw new Error('Goalie statistics require position G.')
  return result
}
