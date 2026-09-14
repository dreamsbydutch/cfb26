# ADR 0013: Separate Program, Power, and Résumé

- Status: Accepted
- Date: 2026-09-12
- Supersedes: the two-system scope and résumé formula in [ADR 0008](0008-separate-power-and-resume-ratings.md)
- Preserves: [ADR 0007](0007-optimize-predictions-with-held-out-seasons.md) predictive promotion gates

## Context

A program persists while its players and coaches change. Historical success informs durability and next-season expectations, but does not earn current-season playoff merit. A single blended score cannot answer those three questions honestly. The owner approved these boundaries through a 25-question design interview and requested implementation.

## Decision

Publish three distinct numerical ratings and consecutive rankings for every confirmed member of the selected season's FBS field, including transitioning programs. Eligibility remains separate. FCS opponents participate internally without entering the public field.

**Program** measures sustained competitive health. Recent five seasons carry most influence, the preceding five fade substantially, and partial seasons contribute in proportion to evidence. Results anchor talent acquisition/retention and development. Brand recognition earns nothing. Coaching continuity is context rather than an automatic bonus.

**Power** predicts general neutral-field strength today with the available roster, normal rest, and standard conditions. Cross-season evidence persists with an offseason transition. Decay, turnover, and matchup-specific features require reliable coverage and held-out prediction evidence. Known personnel changes must not be invented from missing data. Actual venue, weather, rest, travel, and uncertain availability belong in matchup scenarios.

**Résumé** measures this season's achieved merit. Wins lead and dominance materially distinguishes performance. Losses can hurt less but cannot earn positive game credit. Every game has equal calendar standing; capped blowouts yield diminishing rewards. Opponent quality uses current-season performance, independently of historical Power priors, recruiting, or brand. A fixed playoff-contender reference supplies one standard for everyone. Earlier opponents are reevaluated as evidence develops; published vintages remain immutable. Head-to-head breaks effectively equal scores, and championships receive no duplicate trophy bonus.

Résumé opens entering Week 7, using completed evidence through Week 6. Preserve a selection-day edition and continue through the postseason. Maintain current editions and frozen weekly editions for all three systems. Missing information increases uncertainty rather than counting as poor performance. Keep the $0 operating target and disclose unavailable enrichment.

## Consequences

The numerical implementations and remaining data limits live in [Three team ratings](../reference/three-team-ratings.md). Program and Résumé use explicit behavioral tests; their value judgments cannot be settled by winner-prediction accuracy. Power challengers require at least eight complete held-out seasons and joint improvement in margin error and probability calibration. No challenger is promoted merely because its design sounds plausible.

[Back to decisions](README.md)

## Amendment: bounded Program context, September 13, 2026

The owner explicitly chose a small bonus for a team’s own history in Résumé, in addition to opponent context. This supersedes the original no-history Résumé rule. The bonus is capped at 0.15 win-equivalents and requires a current-season win; FBS opponent fitting receives half a game of Program prior. Only completed prior seasons qualify. This intentionally introduces a small prestige preference into otherwise earned merit.

Power may use Program history only after earlier-season prediction validation. The learned 2026 blend passed the existing gates and is released as Power v6; Résumé becomes v5 and Program stays v4. See the [evaluation and reproduction contract](../reference/program-context-2026-09-13.md).

## Amendment: sustained exceptional success, September 13, 2026

The owner chose one Program ranking that remains stable through ordinary variation but responds more strongly to multiple consecutive exceptional seasons. Program v5 applies a bounded adjustment inside its existing results allocation; it does not add another ranking or duplicate trophy points. The common rule uses completed prior-season performance, sample requirements, and achievement confirmation. See the [numerical rule and verification](../reference/program-sustained-success-2026-09-13.md).

The revised Program input failed prediction promotion against the released Power ensemble. Power v6 and Résumé v5 therefore retain the versioned v4 history feature and existing coefficients. Updating a public prestige score does not silently rewrite a validated forecast feature.
