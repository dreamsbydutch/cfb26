const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Provider postseason week numbers can restart at one. Publications never do. */
export function publicationWeek(input: {
  asOf: number
  selected: { seasonType: 'regular' | 'postseason'; week: number } | null
  schedule: ReadonlyArray<{
    seasonType: 'regular' | 'postseason'
    week: number
    startTime: number
  }>
}) {
  if (!input.selected) return 0
  if (input.selected.seasonType === 'regular') return input.selected.week
  const postseason = input.schedule.filter(
    (game) => game.seasonType === 'postseason',
  )
  const firstKickoff = Math.min(...postseason.map((game) => game.startTime))
  const lastRegularWeek = Math.max(
    6,
    ...input.schedule
      .filter((game) => game.seasonType === 'regular')
      .map((game) => game.week),
  )
  const offset = Number.isFinite(firstKickoff)
    ? Math.max(0, Math.floor((input.asOf - firstKickoff) / WEEK_MS))
    : 0
  return Math.min(30, lastRegularWeek + 1 + offset)
}
