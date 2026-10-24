import { rosterGroup, rosterParticipation } from '../michigan/rosterSheetModel'
import { compareAdminRosterPlayers } from './adminRosterOrder'
import type { Infer } from 'convex/values'
import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import type { rosterSpreadsheetValues } from '../../../convex/rosterSpreadsheetFields'
import type { Id } from '../../../convex/_generated/dataModel'

export type SheetValues = Infer<typeof rosterSpreadsheetValues>
export type SheetField = keyof SheetValues
export type SheetData = NonNullable<
  FunctionReturnType<typeof api.rosters.getSeasonDashboard>
>
export type SheetRow = {
  key: string
  playerId?: Id<'players'>
  playerSeasonId?: Id<'playerSeasons'>
  commitmentId?: Id<'commitments'>
  values: SheetValues
}
export type SheetColumn = {
  field: SheetField
  label: string
  group: string
  width?: number
  type?: 'number' | 'decimal'
  options?: ReadonlyArray<readonly [string, string]>
  history?: boolean
  recruit?: boolean
  help?: string
}
const choices = (values: Array<string>) =>
  values.map((value) => [value, value.replaceAll('_', ' ')] as const)

export const sheetColumns: Array<SheetColumn> = [
  {
    field: 'displayName',
    label: 'Player name',
    group: 'Player',
    width: 220,
    recruit: true,
  },
  {
    field: 'jerseyNumber',
    label: '#',
    group: 'Roster',
    type: 'number',
    width: 65,
  },
  {
    field: 'listedPosition',
    label: 'Position',
    group: 'Roster',
    width: 85,
    recruit: true,
  },
  {
    field: 'role',
    label: 'Playing role',
    group: 'Roster',
    width: 135,
    options: [
      ['starter', 'Starter'],
      ['rotation', 'Rotation'],
      ['reserve', 'Bench / Prospect'],
      ['unassigned', 'Unassigned'],
    ],
    help: 'Bench and Prospects are separated by college year on the public roster.',
  },
  {
    field: 'heightInches',
    label: 'Height (in)',
    group: 'Roster',
    type: 'number',
    width: 95,
  },
  {
    field: 'weightPounds',
    label: 'Weight (lb)',
    group: 'Roster',
    type: 'number',
    width: 100,
  },
  {
    field: 'rosterStatus',
    label: 'Roster status',
    group: 'Roster',
    options: choices(['active', 'inactive', 'departed']),
    help: 'For enrollment or departure history, use the player record.',
  },
  {
    field: 'depthStatus',
    label: 'Availability',
    group: 'Roster',
    options: choices(['available', 'limited', 'out', 'unknown']),
  },
  {
    field: 'availabilityNote',
    label: 'Availability note',
    group: 'Roster',
    width: 240,
  },
  {
    field: 'scholarshipStatus',
    label: 'Scholarship',
    group: 'Roster',
    options: choices(['scholarship', 'walk_on', 'exempt', 'unknown']),
  },
  {
    field: 'roomOrder',
    label: 'Room order',
    group: 'Roster',
    type: 'number',
    width: 95,
  },
  {
    field: 'captain',
    label: 'Captain',
    group: 'Roster',
    width: 90,
    options: [
      ['false', 'No'],
      ['true', 'Yes'],
    ],
  },
  {
    field: 'honors',
    label: 'Honors',
    group: 'Roster',
    width: 240,
    help: 'Separate honors with commas.',
  },
  {
    field: 'recruitingRank',
    label: 'Overall rank',
    group: 'Recruiting',
    type: 'number',
    width: 110,
    recruit: true,
    help: '247Sports Composite overall rank. Edits update the evaluation shown in the public Recruit column; blank clears the rank.',
  },
  {
    field: 'recruitingRating',
    label: 'Rating (0–1)',
    group: 'Recruiting',
    type: 'decimal',
    width: 125,
    recruit: true,
    help: '247Sports Composite decimal rating, e.g. 0.9745. Recruiting evaluation preferred; transfer evaluation used when that is the saved source. Blank clears the rating.',
  },
  {
    field: 'gamesPlayed',
    label: 'Overall GP',
    group: 'Participation',
    type: 'number',
    help: 'Overall games, separate from phase-specific games.',
  },
  {
    field: 'starts',
    label: 'Starts',
    group: 'Participation',
    type: 'number',
    width: 80,
  },
  ...(['offense', 'defense', 'specialTeams'] as const).flatMap((phase) => {
    const group =
      phase === 'specialTeams'
        ? 'Special teams'
        : phase === 'offense'
          ? 'Offense'
          : 'Defense'
    return [
      { field: `${phase}Games`, label: 'GP', group, type: 'number', width: 75 },
      {
        field: `${phase}Snaps`,
        label: 'Snaps',
        group,
        type: 'number',
        width: 90,
      },
      {
        field: `${phase}Through`,
        label: 'Team games',
        group,
        type: 'number',
        width: 110,
        help: 'Team games played through the date of these cumulative totals. Fill GP, Snaps and Team games together.',
      },
      ...(phase === 'defense'
        ? [
            {
              field: 'defenseRunDefense',
              label: 'Run defense',
              group,
              type: 'number',
              width: 110,
            },
            {
              field: 'defensePassRush',
              label: 'Pass rush',
              group,
              type: 'number',
              width: 100,
            },
            {
              field: 'defenseCoverage',
              label: 'Coverage',
              group,
              type: 'number',
              width: 100,
            },
          ]
        : []),
      ...(phase === 'offense'
        ? [
            {
              field: 'offensePass',
              label: 'Pass',
              group,
              type: 'number',
              width: 80,
            },
            {
              field: 'offensePassBlock',
              label: 'Pass block',
              group,
              type: 'number',
              width: 100,
            },
            {
              field: 'offenseRun',
              label: 'Run',
              group,
              type: 'number',
              width: 80,
            },
            {
              field: 'offenseRunBlock',
              label: 'Run block',
              group,
              type: 'number',
              width: 100,
            },
          ]
        : []),
    ] as Array<SheetColumn>
  }),
  {
    field: 'eligibilityStart',
    label: 'Recruiting year',
    group: 'Eligibility',
    history: true,
    width: 145,
    help: 'Automatic eligibility start. Class-based estimates are labelled; use the recruiting year override to correct them.',
  },
  {
    field: 'derivedEligibility',
    label: 'Eligible through',
    group: 'Eligibility',
    history: true,
    help: 'Calculated from saved evidence and override.',
  },
  {
    field: 'eligibleThrough',
    label: 'Override',
    group: 'Eligibility',
    type: 'number',
    help: 'Leave blank to calculate from eligibility evidence.',
  },
  {
    field: 'enrollmentSeason',
    label: 'Recruiting year override',
    help: 'Leave blank for the automatic recruiting-year default. Transfers retain their original college recruiting year.',
    group: 'Eligibility',
    type: 'number',
    width: 145,
  },
  {
    field: 'legacyRedshirtSeason',
    label: 'Redshirt year',
    group: 'Eligibility',
    type: 'number',
  },
  {
    field: 'competitionSeasons',
    label: 'Competition years',
    group: 'Eligibility',
    width: 220,
    help: 'Comma-separated seasons, for example 2024, 2025.',
  },
  {
    field: 'medicalHardshipSeasons',
    label: 'Medical extensions',
    group: 'Eligibility',
    type: 'number',
    width: 150,
  },
  {
    field: 'otherExtensionSeasons',
    label: 'Other extensions',
    group: 'Eligibility',
    type: 'number',
    width: 145,
  },
  {
    field: 'ageBasedExceptionSeasons',
    label: 'Age exceptions',
    group: 'Eligibility',
    type: 'number',
  },
  {
    field: 'canonicalName',
    label: 'Canonical name',
    group: 'Background',
    width: 220,
    recruit: true,
  },
  {
    field: 'hometown',
    label: 'Hometown',
    group: 'Background',
    width: 170,
    recruit: true,
  },
  {
    field: 'homeState',
    label: 'Home state',
    group: 'Background',
    width: 100,
    recruit: true,
  },
  {
    field: 'highSchool',
    label: 'High school',
    group: 'Background',
    width: 220,
    recruit: true,
  },
  {
    field: 'entryMethod',
    label: 'Michigan entry',
    group: 'Background',
    options: choices(['high_school', 'transfer', 'walk_on', 'legacy']),
    history: true,
    recruit: true,
  },
  {
    field: 'entrySeason',
    label: 'Entry season',
    group: 'Background',
    history: true,
    recruit: true,
  },
  {
    field: 'personState',
    label: 'Player state',
    group: 'Background',
    options: [
      ['enrolled', 'Enrolled'],
      ['prospect', 'Recruit'],
      ['alumni', 'Alumni'],
    ],
    history: true,
    recruit: true,
  },
  {
    field: 'dataQuality',
    label: 'Verification',
    group: 'Sources',
    options: choices(['owner_verified', 'source_verified', 'needs_review']),
    width: 160,
    recruit: true,
  },
  {
    field: 'personSourceUrls',
    label: 'Player source URLs',
    group: 'Sources',
    width: 300,
    recruit: true,
    help: 'Separate complete source URLs with semicolons.',
  },
  {
    field: 'seasonSourceUrls',
    label: 'Season source URLs',
    group: 'Sources',
    width: 300,
    help: 'Separate complete source URLs with semicolons.',
  },
]

export function emptySheetValues(season: number, recruit = false): SheetValues {
  const blank = Object.fromEntries(
    sheetColumns.map((column) => [column.field, '']),
  ) as SheetValues
  return {
    ...blank,
    entryMethod: 'high_school',
    entrySeason: String(season),
    personState: recruit ? 'prospect' : 'enrolled',
    role: 'unassigned',
    rosterStatus: 'active',
    depthStatus: 'unknown',
    scholarshipStatus: 'unknown',
    captain: 'false',
    gamesPlayed: recruit ? '' : '0',
    starts: recruit ? '' : '0',
    enrollmentSeason: recruit ? '' : String(season),
    medicalHardshipSeasons: recruit ? '' : '0',
    otherExtensionSeasons: recruit ? '' : '0',
    ageBasedExceptionSeasons: recruit ? '' : '0',
    dataQuality: 'owner_verified',
  }
}

const cell = (value: string | number | null | undefined) =>
  value == null ? '' : String(value)

export function spreadsheetRows(data: SheetData): Array<SheetRow> {
  const rows: Array<SheetRow> = []
  const participationOrder = new Map(
    data.entries.map(({ season: annual, eligibility }) => [
      annual._id,
      {
        tier: rosterGroup({
          enrollmentSeason:
            eligibility.startSeason ??
            annual.eligibilityEvidence.enrollmentSeason,
          role: annual.role,
          season: data.season,
        }),
        snaps: rosterParticipation(annual).snaps,
      },
    ]),
  )
  const sortKey = (row: SheetRow) => ({
    position: row.values.listedPosition,
    name: row.values.displayName,
    ...((row.playerSeasonId
      ? participationOrder.get(row.playerSeasonId)
      : undefined) ?? { tier: 'recruit' as const, snaps: null }),
  })
  const enrolled = new Set(data.entries.map((entry) => entry.season.playerId))
  const identity = (
    player: NonNullable<SheetData['entries'][number]['player']>,
  ) => ({
    displayName: player.displayName,
    canonicalName: player.canonicalName,
    hometown: player.hometown ?? '',
    homeState: player.homeState ?? '',
    highSchool: player.highSchool ?? '',
    entryMethod: player.entryMethod,
    entrySeason: cell(player.entrySeason),
    personState: player.state,
    dataQuality: player.dataQuality,
    personSourceUrls: player.sourceLinks.map((source) => source.url).join('; '),
  })
  for (const entry of data.entries) {
    if (!entry.player) continue
    const annual = entry.season
    const values = {
      ...emptySheetValues(data.season),
      ...identity(entry.player),
      recruitingRank: cell(entry.recruiting?.rank),
      recruitingRating: cell(entry.recruiting?.rating),
    }
    for (const field of [
      'jerseyNumber',
      'listedPosition',
      'role',
      'heightInches',
      'weightPounds',
      'rosterStatus',
      'depthStatus',
      'availabilityNote',
      'scholarshipStatus',
      'roomOrder',
      'gamesPlayed',
      'starts',
    ] as const)
      values[field] = cell(annual[field])
    values.captain = String(annual.captain)
    values.honors = annual.honors.join(', ')
    values.eligibleThrough = cell(annual.eligibleThroughSeasonOverride)
    values.derivedEligibility = cell(entry.eligibility.eligibleThroughSeason)
    values.eligibilityStart = `${cell(entry.eligibility.startSeason)}${entry.eligibility.startSource === 'listed_class_estimate' ? ' (estimate)' : ''}`
    values.dataQuality = annual.dataQuality
    values.seasonSourceUrls = annual.sourceLinks
      .map((source) => source.url)
      .join('; ')
    for (const field of [
      'enrollmentSeason',
      'legacyRedshirtSeason',
      'medicalHardshipSeasons',
      'otherExtensionSeasons',
      'ageBasedExceptionSeasons',
    ] as const)
      values[field] = cell(annual.eligibilityEvidence[field])
    values.competitionSeasons =
      annual.eligibilityEvidence.competitionSeasons.join(', ')
    for (const [field, key] of [
      ['defenseRunDefense', 'runDefense'],
      ['defensePassRush', 'passRush'],
      ['defenseCoverage', 'coverage'],
    ] as const)
      values[field] = cell(
        annual.participationTotals?.defense?.defenseBreakdown?.[key],
      )
    for (const phase of ['offense', 'defense', 'specialTeams'] as const) {
      const snapshot = annual.participationTotals?.[phase]
      values[`${phase}Games`] = cell(snapshot?.gamesPlayed)
      values[`${phase}Snaps`] = cell(snapshot?.snaps)
      values[`${phase}Through`] = cell(snapshot?.throughTeamGames)
    }
    for (const [field, key] of [
      ['offensePass', 'pass'],
      ['offensePassBlock', 'passBlock'],
      ['offenseRun', 'run'],
      ['offenseRunBlock', 'runBlock'],
    ] as const)
      values[field] = cell(
        annual.participationTotals?.offense?.offenseBreakdown?.[key],
      )
    rows.push({
      key: annual._id,
      playerId: entry.player._id,
      playerSeasonId: annual._id,
      values,
    })
  }
  for (const entry of data.commitments) {
    if (
      !entry.player ||
      enrolled.has(entry.player._id) ||
      entry.commitment.status !== 'committed'
    )
      continue
    enrolled.add(entry.player._id)
    rows.push({
      key: entry.commitment._id,
      playerId: entry.player._id,
      commitmentId: entry.commitment._id,
      values: {
        ...emptySheetValues(data.season, true),
        ...identity(entry.player),
        recruitingRank: cell(entry.recruiting?.rank),
        recruitingRating: cell(entry.recruiting?.rating),
        listedPosition: entry.commitment.initialPosition,
        dataQuality: entry.commitment.dataQuality,
      },
    })
  }
  return rows.sort((a, b) => compareAdminRosterPlayers(sortKey(a), sortKey(b)))
}

export function editableColumn(row: SheetRow, column: SheetColumn) {
  const isNew = !row.playerId
  if (
    column.field === 'personState' ||
    column.field === 'entrySeason' ||
    column.field === 'derivedEligibility' ||
    column.field === 'eligibilityStart'
  )
    return false
  if (column.history && !isNew) return false
  return Boolean(
    column.recruit ||
    !(row.commitmentId || (isNew && row.values.personState === 'prospect')),
  )
}

export function changedSheetFields(
  before: SheetValues,
  after: SheetValues,
): Array<SheetField> {
  return sheetColumns
    .filter((column) => before[column.field] !== after[column.field])
    .map((column) => column.field)
}
