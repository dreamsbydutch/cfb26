type Opponent = { opponentId: string; opponent: string }

function opponentName(game: Opponent) {
  return game.opponent
    .replace(/^#(?:\d+|--)(?:\/#?(?:\d+|--))?\s+/, '')
    .replace(/\s*\(ex\)/i, '')
    .replace(/\s*\(#\d+\)$/, '')
    .trim()
}

export function scheduleOpponentKey(game: Opponent) {
  return `${game.opponentId}:${opponentName(game).replace(/\s+University$/, '')}`
}

export function scheduleOpponentOptions(games: Array<Opponent>) {
  return [
    ...new Map(
      games.map((game) => [scheduleOpponentKey(game), opponentName(game)]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]))
}
