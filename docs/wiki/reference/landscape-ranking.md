# Landscape ranking and game importance

[Reference index](README.md) · [Wiki home](../README.md)

## Current ranking

**Current:** `/games` ranks every team returned by the CollegeFootballData historical Elo endpoint for the selected season. The displayed rank is the descending position of the latest stored season snapshot; it is not an AP poll and is not presented as a proprietary rating. `teamSeasonRatings` stores one compact row per program/season, while `ratings.list` and `ratings.getWeeklyDashboard` read at most 200 indexed rows.

The credential-gated synchronizer refreshes Elo beside each schedule backfill and daily current-season game refresh. Development currently stores 3,340 season snapshots covering 2000–2025; CFBD does not yet return a 2026 rating snapshot. The source contract is documented in the official [CFBD ratings reference](https://api.collegefootballdata.com/api/ratings).

## National importance

Every weekly FBS game receives a 0–100 score. When a stored season rating is absent, the scorer falls back to the game's pregame/postgame Elo and finally 1500.

1. Convert each Elo to team strength: `clamp((Elo - 1300) / 6, 0, 100)`.
2. Combine the teams as `65% stronger team + 35% weaker team`.
3. Estimate matchup closeness from the absolute Elo gap after adding 55 points for a non-neutral home field: `100 - min(gap / 4, 100)`.
4. Calculate national importance as `70% game quality + 30% closeness`, rounded and clamped to 0–100.

The score favors games with strong teams while preserving value for competitive matchups. It currently excludes playoff probability, standings leverage, television audience, betting markets, injuries, and rivalry metadata.

## Michigan importance

The Michigan lens starts from national importance and applies the strongest matching relationship:

| Relationship                          | Score                             |
| ------------------------------------- | --------------------------------- |
| Michigan is playing                   | `100`                             |
| Both teams appear on Michigan's slate | `75 + 20% of national importance` |
| One team appears on Michigan's slate  | `48 + 35% of national importance` |
| At least one team is in the Big Ten   | `25 + 30% of national importance` |
| Other national game                   | `15% of national importance`      |

The result is rounded and clamped to 0–100. A team counts as a Michigan opponent when it appears anywhere on Michigan's stored schedule for that season, so opponent results remain visible as strength-of-schedule context before and after the Michigan matchup.

## Interpretation

- The ranking measures team strength; the importance scores prioritize a weekly viewing slate.
- National and Michigan scores are intentionally separate and can order the same games differently.
- These formulas are a transparent first version. Any future playoff-leverage or resume model should add explicit inputs and supersede the scoring decision through an ADR.

[Back to reference index](README.md)
