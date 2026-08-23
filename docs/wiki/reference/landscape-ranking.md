# Proprietary team ratings and game importance

[Reference index](README.md) · [Wiki home](../README.md)

## Current model

**Current in development:** `/games` exposes the `cfb26-composite-v1` model for every FBS team with an available season baseline from 2000 through 2026. It is an app-owned composite, not an AP poll, betting line, or repackaged vendor rank. Production still serves the previous Elo-only contract until this checked-in schema and its rating snapshots are promoted.

Every numeric rating is a 0–100 within-season percentile. A 90 means the team scores at or above roughly 90% of that season's modeled teams for that perspective; it does not mean a 90% win probability. Ties receive the same midpoint percentile.

The model stores 16 perspectives:

| Perspective                   | What it measures                                                                                 |   Overall weight |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ---------------: |
| Power                         | Elo, SRS, SP+, FPI, CORE, opponent-adjusted margins, and second-order results                    |              28% |
| Offense                       | Efficiency, success, explosiveness, finishing drives, scoring, yards per play, and ball security |              14% |
| Defense                       | Opponent efficiency, success and explosiveness allowed, scoring and yards allowed, and havoc     |              14% |
| Pass offense / pass defense   | Passing PPA, success, explosiveness, yards per attempt, and completion rate                      |        2.5% each |
| Run offense / run defense     | Rushing PPA, success, explosiveness, line yards, stuff rate, power success, and yards per carry  |        2.5% each |
| Situational offense / defense | Standard/passing downs, field position, finishing drives, third downs, turnovers, and havoc      |        2.5% each |
| Special teams                 | SP+/FPI special-teams value plus available kicking, punting, and return results                  |               4% |
| Talent                        | 247 talent composite, four-year weighted recruiting pipeline, and covered prior draft capital    |               8% |
| Continuity                    | Returning PPA and usage across passing, receiving, and rushing                                   |               5% |
| Résumé                        | Record, SRS/SOS, strength of record, game control, quality wins, margins, and championships      |               8% |
| Form                          | Last-five and full-season opponent-adjusted margins, road form, and consistency                  |               4% |
| Tempo                         | Relative pace and play volume                                                                    | Descriptive only |
| Volatility                    | Margin variance and offensive/defensive explosiveness                                            | Descriptive only |

Within each perspective, the model reweights only the signals that exist for that team and season. A wholly unavailable perspective is neutral at 50. That prevents a missing provider field from becoming a zero, while the separate confidence score makes the loss of evidence visible.

## Inputs and coverage

The deterministic builder uses the checked-in database before it uses any external model:

- stored Elo snapshots and pre/postgame Elo;
- standings, record, SRS/SOS, championships, and complete offense/defense per-game splits;
- compact completed games, venue-adjusted margins, opponent quality, recent form, and head-to-head history;
- the rolling five-season detailed game-stat rows, including available efficiency, turnover, havoc, third-down, and special-teams categories;
- four recruiting classes weighted toward the selected season;
- prior draft value only when the loaded national draft window has enough rows to distinguish missing coverage from zero selections.

The credential-gated rating-input sync also requests six official CollegeFootballData sources independently: [CORE, SP+, and FPI](https://api.collegefootballdata.com/api/ratings), [advanced season statistics](https://api.collegefootballdata.com/api/stats), [247Sports Team Talent Composite](https://api.collegefootballdata.com/api/teams), and [returning production](https://api.collegefootballdata.com/api/players). A source can return no preseason data or fail at the account's access tier without blocking the other sources or the deterministic rebuild.

Confidence is source coverage, not predictive certainty. The source weights total 100: games 13, advanced stats 12, Elo 10, CORE 10, SP+ 10, standings 8, detailed game stats 8, FPI 8, recruiting 8, returning production 5, talent 5, and covered draft history 3. The 2025 development snapshot currently reaches 97% for fully covered teams; the 2026 preseason snapshot is intentionally lower because games, standings, Elo, CORE, and advanced in-season data do not yet exist.

## Head-to-head projection

The matchup lab compares two stored composite snapshots at a neutral site or either home venue. Its rows answer distinct questions:

- overall composite against overall composite;
- each offense against the opponent's defense;
- pass offense against pass defense;
- run offense against run defense;
- situational offense against situational defense;
- special teams;
- talent plus continuity;
- résumé plus recent form;
- volatility, where higher means a wider outcome range rather than a stronger team.

The projected margin combines the overall difference, both offense/defense interactions, pass/run/situational interactions, special teams, talent, continuity, résumé, form, and a 2.5-point non-neutral home adjustment. The lower of the two confidence scores shrinks the margin toward zero. Win probability is a logistic transform of that shrunken margin, capped at 3–97%; the projected total uses both offenses, both defenses, and tempo. These values are comparative model estimates and must not be presented as betting lines.

Stored completed meetings since 2000 are displayed as context but do not receive an extra rivalry or series-history weight. That avoids treating games played by different rosters and coaches as current-team evidence.

## Weekly importance

Team strength and weekly importance remain separate. For each game, the scorer uses proprietary overall ratings when available and falls back to converted Elo only when no composite snapshot exists.

1. Combine the stronger and weaker team as `65% stronger + 35% weaker`.
2. Add `55 / 6` rating points to a non-neutral home team for the competitiveness calculation.
3. Set closeness to `100 - min(abs(adjusted gap) × 2.5, 100)`.
4. Set national importance to `70% game quality + 30% closeness`, rounded and clamped to 0–100.

The Michigan lens then applies the strongest relationship:

| Relationship                          | Score                             |
| ------------------------------------- | --------------------------------- |
| Michigan is playing                   | `100`                             |
| Both teams appear on Michigan's slate | `75 + 20% of national importance` |
| One team appears on Michigan's slate  | `48 + 35% of national importance` |
| At least one team is in the Big Ten   | `25 + 30% of national importance` |
| Other national game                   | `15% of national importance`      |

## Known limits

- Percentiles are season-relative, so a 90 in 2001 is not asserted to equal a 90 in 2026.
- Vendor ratings are supporting signals, not ground truth; correlated inputs are grouped into perspectives before the final blend.
- Injuries, depth-chart availability, weather, coaching changes, travel, live betting markets, and playoff probability are not modeled.
- Early-season and historical confidence vary with source coverage. Missing values are never imputed as worst-in-class.
- The formula is deterministic and versioned, but it has not yet been calibrated against a held-out prediction set. Accuracy claims require a future backtest.

[Back to reference index](README.md)
