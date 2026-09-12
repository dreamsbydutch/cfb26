/** Verified exceptions supplement a feed that does not expose cancellations. */
export const CONFIRMED_CANCELLATIONS = [
  {
    sourceGameId: 401640992,
    season: 2024,
    confirmedAt: Date.UTC(2024, 8, 27),
    source: 'https://appstatesports.com/sports/football/schedule/2024',
  },
] as const

export function isFbsGame(game: {
  homeClassification?: string
  awayClassification?: string
}) {
  return (
    game.homeClassification === 'fbs' ||
    game.awayClassification === 'fbs' ||
    (game.homeClassification === undefined &&
      game.awayClassification === undefined)
  )
}

export function cancellationEvidence(game: {
  sourceGameId?: number
  season: number
  completed: boolean
  canceled?: boolean
  cancellationSource?: string
}) {
  if (game.completed) return undefined
  if (game.canceled && game.cancellationSource?.startsWith('https://'))
    return game.cancellationSource
  return CONFIRMED_CANCELLATIONS.find(
    (row) =>
      row.sourceGameId === game.sourceGameId && row.season === game.season,
  )?.source
}

export function isResolvedGame(
  game: Parameters<typeof cancellationEvidence>[0] & {
    homePoints?: number | null
    awayPoints?: number | null
  },
) {
  return (
    (game.completed &&
      Number.isFinite(game.homePoints) &&
      Number.isFinite(game.awayPoints)) ||
    cancellationEvidence(game) !== undefined
  )
}
