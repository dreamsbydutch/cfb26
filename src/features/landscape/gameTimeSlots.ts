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
