export type ParticipationPhase = 'offense' | 'defense' | 'specialTeams'
export type ParticipationCounts = {
  gamesPlayed: number
  snaps: number
  defenseBreakdown?: { runDefense: number; passRush: number; coverage: number }
  offenseBreakdown?: {
    pass: number
    passBlock: number
    run: number
    runBlock: number
  }
}
export type ParticipationImport = {
  season: number
  phase: ParticipationPhase
  throughTeamGames: number
  sourceLabel: string
  sourceImageSha256: string
  rows: Array<
    ParticipationCounts & {
      name: string
      jerseyNumber: number
      playerId?: string
    }
  >
}

export function sameParticipationCounts(
  left: ParticipationCounts,
  right: ParticipationCounts,
) {
  return (
    left.gamesPlayed === right.gamesPlayed &&
    left.snaps === right.snaps &&
    (['runDefense', 'passRush', 'coverage'] as const).every(
      (key) => left.defenseBreakdown?.[key] === right.defenseBreakdown?.[key],
    ) &&
    (['pass', 'passBlock', 'run', 'runBlock'] as const).every(
      (key) => left.offenseBreakdown?.[key] === right.offenseBreakdown?.[key],
    )
  )
}

function whole(value: number, label: string, maximum: number) {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be a whole number from 0 to ${maximum}.`)
  }
}

export function validateParticipationCounts(
  row: ParticipationCounts,
  phase: ParticipationPhase,
  throughTeamGames: number,
  label = 'Player',
) {
  whole(throughTeamGames, 'Team games cutoff', 30)
  if (throughTeamGames === 0)
    throw new Error('A team games cutoff is required.')
  whole(row.gamesPlayed, `${label}: games`, throughTeamGames)
  whole(row.snaps, `${label}: snaps`, throughTeamGames * 200)
  if (
    (row.snaps === 0) !== (row.gamesPlayed === 0) ||
    row.snaps < row.gamesPlayed
  )
    throw new Error(`${label}: games and snaps disagree.`)
  if (row.offenseBreakdown) {
    if (phase !== 'offense')
      throw new Error('Offensive breakdown requires offense phase.')
    const values = Object.values(row.offenseBreakdown)
    values.forEach((value) =>
      whole(value, `${label}: snap breakdown`, row.snaps),
    )
    if (values.reduce((sum, value) => sum + value, 0) !== row.snaps)
      throw new Error(`${label}: snap breakdown does not sum to total.`)
  }
  if (row.defenseBreakdown) {
    if (phase !== 'defense')
      throw new Error('Defensive breakdown requires defense phase.')
    const values = Object.values(row.defenseBreakdown)
    values.forEach((value) =>
      whole(value, `${label}: defensive snap breakdown`, row.snaps),
    )
    if (values.reduce((sum, value) => sum + value, 0) !== row.snaps)
      throw new Error(`${label}: defensive snap breakdown does not sum to total.`)
  }
}

export function validateParticipationImport(input: ParticipationImport) {
  whole(input.season, 'Season', 2100)
  if (input.season < 2015) throw new Error('Season must be 2015 or later.')
  if (!['offense', 'defense', 'specialTeams'].includes(input.phase))
    throw new Error('Unknown phase.')
  whole(input.throughTeamGames, 'Team games cutoff', 30)
  if (input.throughTeamGames === 0)
    throw new Error('A team games cutoff is required.')
  if (!input.sourceLabel.trim() || input.sourceLabel.length > 240)
    throw new Error('Source label is required (maximum 240 characters).')
  if (!/^[a-f0-9]{64}$/.test(input.sourceImageSha256))
    throw new Error('Source image SHA-256 is required.')
  if (input.rows.length < 1 || input.rows.length > 100)
    throw new Error('Import between 1 and 100 players.')
  const names = new Set<string>()
  for (const row of input.rows) {
    const name = normalizeParticipationName(row.name)
    if (!name || row.name.length > 120 || names.has(name))
      throw new Error(`Missing or duplicate player: ${row.name}`)
    names.add(name)
    whole(row.jerseyNumber, `${row.name}: jersey`, 99)
    validateParticipationCounts(
      row,
      input.phase,
      input.throughTeamGames,
      row.name,
    )
  }
}

// Punctuation and suffix differences are tolerated; jersey remains an independent check.
export function normalizeParticipationName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\.?$/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function assertSnapshotCanReplace(
  incoming: ParticipationCounts & { throughTeamGames: number },
  current?: ParticipationCounts & { throughTeamGames: number },
) {
  if (!current) return
  if (incoming.throughTeamGames < current.throughTeamGames)
    throw new Error('Screenshot is older than the saved cutoff.')
  if (
    incoming.snaps < current.snaps ||
    incoming.gamesPlayed < current.gamesPlayed
  )
    throw new Error(
      'Cumulative totals cannot decrease; review the correction separately.',
    )
}
