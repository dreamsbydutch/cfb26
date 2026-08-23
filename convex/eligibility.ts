import type { Doc } from './_generated/dataModel'

export function publicRosterStint(stint: Doc<'rosterStints'>) {
  const { redshirtSeasons, ...publicStint } = stint
  const medicalExtensionSeasons = Math.max(
    stint.medicalExtensionSeasons ?? (redshirtSeasons ?? 1) - 1,
    0,
  )

  return {
    ...publicStint,
    eligibilityEndSeason:
      stint.eligibilityStartSeason + 4 + medicalExtensionSeasons,
    medicalExtensionSeasons,
  }
}
