type CommitmentEntry = {
  commitment: {
    playerId: string
    status: string
  }
}

export function findActiveCommitment<TEntry extends CommitmentEntry>(
  commitments: ReadonlyArray<TEntry>,
  playerId: string,
) {
  return (
    commitments.find(
      (entry) =>
        String(entry.commitment.playerId) === playerId &&
        entry.commitment.status === 'committed',
    ) ?? null
  )
}

export function parseOwnerSeason(
  storedValue: string | null,
  currentSeason: number,
) {
  const season = Number(storedValue)
  return Number.isInteger(season) &&
    season >= 2015 &&
    season <= currentSeason + 1
    ? season
    : currentSeason
}
