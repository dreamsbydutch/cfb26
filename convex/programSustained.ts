import type { ProgramSeasonEvidence } from './programRating.ts'
import type { ProgramAccomplishment } from './programAccomplishments.ts'

/** Prestige policy: repeated excellence can establish a stronger results baseline. */
export function sustainedProgramResults(
  rows: ReadonlyArray<ProgramSeasonEvidence>,
  honors: ReadonlyArray<ProgramAccomplishment>,
  season: number,
  baseline: number,
) {
  const eligible = new Map(
    rows
      .filter((row) => row.season < season && row.games >= 10)
      .map((row) => [row.season, row]),
  )
  const quality = (row: ProgramSeasonEvidence) => {
    if (row.performance <= 75) return 0
    const achieved = honors.some(
      (honor) =>
        honor.season === row.season &&
        (honor.playoffStage > 0 || honor.conferenceChampion),
    )
    // Accomplishments confirm sustained quality; they do not add another trophy award.
    return (
      Math.max(achieved ? 0.5 : 0, Math.min(1, (row.performance - 75) / 15)) *
      Math.min(row.games / 12, 1)
    )
  }
  let lift = 0
  for (const [year, recent] of eligible) {
    const previous = eligible.get(year - 1)
    if (!previous) continue
    const age = season - year - 1
    const level = (recent.performance + previous.performance) / 2
    const confirmation = Math.min(quality(recent), quality(previous))
    lift = Math.max(
      lift,
      Math.min(16, Math.max(0, level - baseline)) * confirmation * 0.74 ** age,
    )
  }
  // The strongest pair counts once; overlapping pairs cannot stack awards.
  return { results: Math.min(100, baseline + lift), ratingLift: lift * 0.5 }
}
