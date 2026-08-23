import type { Doc } from './_generated/dataModel'

export function publicRosterStint(stint: Doc<'rosterStints'>) {
  const { redshirtSeasons, ...publicStint } = stint
  const medicalExtensionSeasons = Math.max(
    stint.medicalExtensionSeasons ?? (redshirtSeasons ?? 1) - 1,
    0,
  )
  const extraEligibilitySeasons = Math.max(
    Math.floor(stint.extraEligibilitySeasons ?? 0),
    0,
  )

  return {
    ...publicStint,
    eligibilityEndSeason:
      stint.eligibilityStartSeason +
      4 +
      medicalExtensionSeasons +
      extraEligibilitySeasons,
    extraEligibilitySeasons,
    medicalExtensionSeasons,
  }
}
