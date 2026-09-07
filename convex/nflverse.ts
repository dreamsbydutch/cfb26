export type CsvRow = Record<string, string>

export function parseCsv(text: string): Array<CsvRow> {
  const records: Array<Array<string>> = []
  let record: Array<string> = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') quoted = false
      else field += character
      continue
    }
    if (character === '"') quoted = true
    else if (character === ',') {
      record.push(field)
      field = ''
    } else if (character === '\n') {
      record.push(field.replace(/\r$/, ''))
      if (record.some((value) => value !== '')) records.push(record)
      record = []
      field = ''
    } else field += character
  }
  if (field || record.length) {
    record.push(field.replace(/\r$/, ''))
    records.push(record)
  }
  const [headers, ...rows] = records
  if (!headers.length) return []
  return rows.map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? '']),
    ),
  )
}

export function nflRosterStatus(value: string) {
  const normalized = value.trim().toUpperCase()
  if (normalized === 'ACT') return 'active' as const
  if (normalized === 'DEV') return 'practice_squad' as const
  if (['PUP', 'RSN', 'RSR'].includes(normalized))
    return 'injured_reserve' as const
  if (['RES', 'EXE', 'E14', 'SUS'].includes(normalized))
    return 'reserve' as const
  return 'inactive' as const
}

const STAT_FIELDS = [
  'completions',
  'attempts',
  'passing_yards',
  'passing_tds',
  'passing_interceptions',
  'carries',
  'rushing_yards',
  'rushing_tds',
  'receptions',
  'targets',
  'receiving_yards',
  'receiving_tds',
  'sacks',
  'def_tackles',
  'def_tackles_solo',
  'def_tackles_for_loss',
  'def_sacks',
  'def_qb_hits',
  'def_interceptions',
  'def_pass_defended',
  'fg_made',
  'fg_attempts',
  'pat_made',
  'pat_attempts',
] as const

export function nflStatistics(row: CsvRow) {
  return STAT_FIELDS.flatMap((category) => {
    const value = Number(row[category])
    return Number.isFinite(value) && value !== 0 ? [{ category, value }] : []
  })
}
