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
) {
  return deriveEligibility({
    evidence: season.eligibilityEvidence,
    override: season.eligibleThroughSeasonOverride,
    rule: rule
      ? {
          baseEligibilitySeasons: rule.baseEligibilitySeasons,
          clockSeasons: rule.clockSeasons,
          legacyRedshirtExtendsClock: rule.legacyRedshirtExtendsClock,
          season: rule.season,
        }
      : DEFAULT_ELIGIBILITY_RULE,
  })
}
