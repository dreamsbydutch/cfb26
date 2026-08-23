import type { MutationCtx } from './_generated/server'

export type ProgramSource =
  'recruiting' | 'standings' | 'draft' | 'games' | 'game_stats' | 'ratings'

const PROGRAM_KEY_ALIASES: Readonly<Record<string, string>> = {
  'alabama-birmingham': 'uab',
  'brigham-young': 'byu',
  'central-florida': 'ucf',
  connecticut: 'uconn',
  'louisiana-state': 'lsu',
  massachusetts: 'umass',
  mississippi: 'ole-miss',
  'north-carolina-state': 'nc-state',
  pittsburgh: 'pitt',
  'southern-california': 'usc',
  'southern-methodist': 'smu',
  'texas-christian': 'tcu',
  'texas-el-paso': 'utep',
  'texas-san-antonio': 'utsa',
}

const PROGRAM_NAMES: Readonly<Record<string, string>> = {
  byu: 'BYU',
  lsu: 'LSU',
  'nc-state': 'NC State',
  smu: 'SMU',
  tcu: 'TCU',
  uab: 'UAB',
  ucf: 'UCF',
  uconn: 'UConn',
  umass: 'UMass',
  usc: 'USC',
  utep: 'UTEP',
  utsa: 'UTSA',
}

export function slug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function canonicalProgramKey(name: string) {
  const normalized = slug(name)
  return PROGRAM_KEY_ALIASES[normalized] ?? normalized
}

export async function resolveProgram(
  ctx: MutationCtx,
  source: ProgramSource,
  sourceName: string,
) {
  const sourceKey = `${source}:${slug(sourceName)}`
  const alias = await ctx.db
    .query('programAliases')
    .withIndex('by_sourceKey', (q) => q.eq('sourceKey', sourceKey))
    .unique()
  if (alias) return alias.programId

  const programKey = canonicalProgramKey(sourceName)
  const existingProgram = await ctx.db
    .query('programs')
    .withIndex('by_key', (q) => q.eq('key', programKey))
    .unique()
  const programId =
    existingProgram?._id ??
    (await ctx.db.insert('programs', {
      key: programKey,
      name: PROGRAM_NAMES[programKey] ?? sourceName,
    }))

  await ctx.db.insert('programAliases', {
    programId,
    source,
    sourceKey,
    sourceName,
  })
  return programId
}
