import { deriveEligibility } from './playerDomain'
import type { Doc } from './_generated/dataModel'

export const DEFAULT_ELIGIBILITY_RULE = {
  baseEligibilitySeasons: 4,
  clockSeasons: 5,
  legacyRedshirtExtendsClock: false,
  season: 2026,
} as const

export function resolvePlayerSeasonEligibility(
  season: Doc<'playerSeasons'>,
  rule: Doc<'seasonRules'> | null,
  player?: Pick<Doc<'players'>, 'entryMethod' | 'entrySeason'> | null,
) {
  // Michigan arrival is not an original recruiting year for transfers or
  // retrospective roster imports. Listed college year provides a marked
  // estimate when the original year has not been saved.
  const classYears: Readonly<Record<string, number>> = {
    FR: 1,
    SO: 2,
    JR: 3,
    SR: 4,
    '5TH': 5,
  }
  const listedYear = classYears[season.listedClass?.trim().toUpperCase() ?? '']
  const entryYear =
    player && ['high_school', 'walk_on'].includes(player.entryMethod)
      ? player.entrySeason
      : null
  const startSeason =
    season.eligibilityEvidence.enrollmentSeason ??
    entryYear ??
    (listedYear ? season.season - listedYear + 1 : null)
  const startSource =
    season.eligibilityEvidence.enrollmentSeason !== null
      ? 'saved'
      : entryYear !== null
        ? 'recruiting_entry'
        : listedYear
          ? 'listed_class_estimate'
          : 'unknown'
  return {
    ...deriveEligibility({
      evidence: {
        ...season.eligibilityEvidence,
        enrollmentSeason: startSeason,
      },
      override: season.eligibleThroughSeasonOverride,
      rule: rule
        ? {
            baseEligibilitySeasons: rule.baseEligibilitySeasons,
            clockSeasons: rule.clockSeasons,
            legacyRedshirtExtendsClock: rule.legacyRedshirtExtendsClock,
            season: rule.season,
          }
        : DEFAULT_ELIGIBILITY_RULE,
    }),
    startSeason,
    startSource,
  }
}
