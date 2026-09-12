export type EfficiencyUnit = {
  ppa: number
  successRate: number
  plays: number
  drives: number
}
export type CompetitiveDrives = {
  possessions: number
  points: number
  conceded: number
  plays: number
}
export type GameEvidence = {
  observedAt: number
  version: 'competitive-v1'
  home?: EfficiencyUnit
  away?: EfficiencyUnit
  homeDrives?: CompetitiveDrives
  awayDrives?: CompetitiveDrives
}
export type DriveEvidence = {
  id: string
  gameId: number
  isHomeOffense: boolean
  startPeriod: number
  endPeriod: number
  startOffenseScore: number
  startDefenseScore: number
  endOffenseScore: number
  endDefenseScore: number
  plays: number
  driveResult: string
}

/** Defined from the score BEFORE a drive, so a decisive scoring drive still counts. */
export function aggregateCompetitiveDrives(
  drives: ReadonlyArray<DriveEvidence>,
) {
  const games = new Map<
    number,
    { homeDrives: CompetitiveDrives; awayDrives: CompetitiveDrives }
  >()
  const seen = new Set<string>()
  const empty = (): CompetitiveDrives => ({
    possessions: 0,
    points: 0,
    conceded: 0,
    plays: 0,
  })
  for (const drive of drives) {
    const key = `${drive.gameId}:${drive.id}`
    if (seen.has(key)) throw new Error('Duplicate drive identity.')
    seen.add(key)
    const gap = Math.abs(drive.startOffenseScore - drive.startDefenseScore)
    const limit =
      drive.startPeriod <= 1
        ? Infinity
        : drive.startPeriod === 2
          ? 38
          : drive.startPeriod === 3
            ? 28
            : 22
    if (
      drive.startPeriod < 1 ||
      drive.startPeriod > 4 ||
      drive.endPeriod > 4 ||
      gap > limit ||
      drive.plays < 1 ||
      /end.*(half|game)|kneel/i.test(drive.driveResult)
    )
      continue
    const scored = drive.endOffenseScore - drive.startOffenseScore
    const conceded = drive.endDefenseScore - drive.startDefenseScore
    if (
      ![scored, conceded, drive.plays].every(Number.isFinite) ||
      scored < 0 ||
      conceded < 0 ||
      scored > 8 ||
      conceded > 8
    )
      continue
    const game = games.get(drive.gameId) ?? {
      homeDrives: empty(),
      awayDrives: empty(),
    }
    const unit = drive.isHomeOffense ? game.homeDrives : game.awayDrives
    unit.possessions++
    unit.points += scored
    unit.conceded += conceded
    unit.plays += drive.plays
    games.set(drive.gameId, game)
  }
  return games
}

/** Equal possession opportunities; preserve actual wins in the separate results component. */
export function competitiveMargin(evidence: GameEvidence | undefined) {
  const home = evidence?.homeDrives,
    away = evidence?.awayDrives
  if (!home || !away || home.possessions < 6 || away.possessions < 6)
    return undefined
  return (
    12 *
    ((home.points - home.conceded) / home.possessions -
      (away.points - away.conceded) / away.possessions)
  )
}

export function efficiencyMargin(evidence: GameEvidence | undefined) {
  const home = evidence?.home,
    away = evidence?.away
  if (!home || !away || home.plays < 30 || away.plays < 30) return undefined
  // PPA is already a down/distance/field-position measure. Equal plays remove pace.
  return Math.max(-35, Math.min(35, 65 * (home.ppa - away.ppa)))
}

/** Poisson-binomial tail for a fixed contender matching or exceeding this record. */
export function recordDifficulty(
  probabilities: ReadonlyArray<number>,
  wins: number,
) {
  if (!Number.isInteger(wins) || wins < 0 || wins > probabilities.length)
    throw new Error('Invalid record.')
  let distribution = [1]
  for (const p of probabilities) {
    if (!Number.isFinite(p) || p < 0 || p > 1)
      throw new Error('Invalid win probability.')
    const next = Array<number>(distribution.length + 1).fill(0)
    for (let i = 0; i < distribution.length; i++) {
      next[i] += distribution[i] * (1 - p)
      next[i + 1] += distribution[i] * p
    }
    distribution = next
  }
  const probability = distribution.slice(wins).reduce((a, b) => a + b, 0)
  return {
    probability,
    difficulty: Math.max(0, -Math.log10(Math.max(1e-12, probability))),
  }
}
