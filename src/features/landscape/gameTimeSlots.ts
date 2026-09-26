export type GameTimeSlot = {
  dateKey: string
  dateLabel: string
  id:
    | 'early'
    | 'noon'
    | 'early-afternoon'
    | 'afternoon'
    | 'early-evening'
    | 'night'
    | 'late-night'
  label: string
}

type ScheduledGame = {
  startTime: number
  completed: boolean
  canceled?: boolean
  homePoints?: number
  awayPoints?: number
  landscapeRating: number
  michiganRating: number
}

export function gameStatus(game: ScheduledGame, now: number) {
  if (game.canceled) return 'Canceled'
  if (game.completed) {
    return Number.isFinite(game.homePoints) && Number.isFinite(game.awayPoints)
      ? 'Final'
      : 'Result pending'
  }
  if (game.startTime > now) return 'Upcoming'
  // Kickoff alone cannot establish live status or a final result.
  return now - game.startTime < 8 * 60 * 60 * 1000
    ? 'Started'
    : 'Result pending'
}

export function scheduleSections<T extends ScheduledGame>(
  games: Array<T>,
  lens: 'landscape' | 'michigan',
  now: number,
) {
  const field = lens === 'landscape' ? 'landscapeRating' : 'michiganRating'
  const sections = [
    { label: 'Upcoming', games: [] as Array<T> },
    { label: 'Started', games: [] as Array<T> },
    { label: 'Past games & results', games: [] as Array<T> },
  ]
  for (const game of games) {
    const status = gameStatus(game, now)
    sections[
      status === 'Upcoming' ? 0 : status === 'Started' ? 1 : 2
    ].games.push(game)
  }
  return sections
    .filter((section) => section.games.length > 0)
    .map((section) => {
      const past = section.label === 'Past games & results'
      const groups = new Map<
        string,
        {
          key: string
          label: string
          dateLabel: string
          startTime: number
          games: Array<T>
        }
      >()
      for (const game of [...section.games].sort(
        (a, b) => a.startTime - b.startTime,
      )) {
        const slot = gameTimeSlot(game.startTime)
        const key = `${slot.dateKey}-${slot.id}`
        const group = groups.get(key) ?? {
          key,
          label: slot.label,
          dateLabel: slot.dateLabel,
          startTime: game.startTime,
          games: [],
        }
        group.games.push(game)
        groups.set(key, group)
      }
      return {
        label: section.label,
        groups: [...groups.values()]
          .sort((a, b) =>
            past ? b.startTime - a.startTime : a.startTime - b.startTime,
          )
          .map((group) => ({
            ...group,
            games: group.games.sort((a, b) =>
              past
                ? b.startTime - a.startTime
                : b[field] - a[field] || a.startTime - b.startTime,
            ),
          })),
      }
    })
}

const easternParts = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'America/New_York',
  weekday: 'long',
  year: 'numeric',
})

const easternDate = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/New_York',
  weekday: 'long',
})

export function gameTimeSlot(startTime: number): GameTimeSlot {
  const kickoff = new Date(startTime)
  const parts = Object.fromEntries(
    easternParts
      .formatToParts(kickoff)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  const minutes = Number(parts.hour) * 60 + Number(parts.minute)
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`
  const dateLabel = easternDate.format(kickoff)

  if (minutes < 11 * 60 + 30) {
    return { dateKey, dateLabel, id: 'early', label: 'Early games' }
  }
  if (minutes < 13 * 60) {
    return { dateKey, dateLabel, id: 'noon', label: 'Noon slate' }
  }
  if (minutes < 14 * 60 + 30) {
    return {
      dateKey,
      dateLabel,
      id: 'early-afternoon',
      label: 'Early afternoon',
    }
  }
  if (minutes < 16 * 60 + 30) {
    return {
      dateKey,
      dateLabel,
      id: 'afternoon',
      label: 'Afternoon slate',
    }
  }
  if (minutes < 18 * 60) {
    return {
      dateKey,
      dateLabel,
      id: 'early-evening',
      label: 'Early evening',
    }
  }
  if (minutes < 21 * 60 + 30) {
    return { dateKey, dateLabel, id: 'night', label: 'Night slate' }
  }
  return { dateKey, dateLabel, id: 'late-night', label: 'Late-night slate' }
}
