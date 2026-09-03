# Proprietary team ratings and game importance

[Reference index](README.md) · [Wiki home](../README.md)

## Current rating systems

**Current in checked-in source:** `cfb26-power-v1` and `cfb26-resume-v1` replace the manually weighted percentile composite. The new 21-table contract has not been pushed: development still hosts the previous 19-table composite contract and production remains on the earlier Elo foundation.

### CFB26 Power Rating

Power answers “How strong is this team right now?” in expected points above or below an average FBS team on a neutral field. The pure model:

- creates two scoring observations per completed game and jointly estimates opponent-adjusted offense and defense;
- separately fits robust opponent-adjusted margin strength, then reconciles offense, defense, and strongly shrunk special teams to that neutral power estimate;
- estimates each team’s home-field value around a strongly regularized 2.5-point population prior without adding it to neutral rank;
- caps regulation margins at 35 points, caps overtime margins at one possession, bounds extreme totals, and applies Huber residual weights;
- gives every current-season game equal weight;
- carries up to four earlier seasons through a recursively faded performance prior; and
- rates FCS opponents with stronger shrinkage while excluding them from the published rank.

The model accepts a versioned logistic margin calibrator. Until an eight-season held-out evaluation promotes learned coefficients, published builds explicitly identify the existing `fixed-logistic-v1` probability mapping. Talent, returning production, transfers, coaching, and recency are not silently activated: each requires reliable historical coverage and promotion under [ADR 0007](../decisions/0007-optimize-predictions-with-held-out-seasons.md).

### CFB26 Résumé Rating

Résumé answers “Whose record was hardest to achieve?” in wins above the expectation of an average top-25 team. The reference strength and home-field value are fixed from the current edition’s top 25. For every completed regular- or postseason game:

- the schedule component adds actual wins minus the reference team’s venue-adjusted expected wins;
- the dominance component compares a logistic win-equivalent for the actual margin with that same expectation;
- regulation dominance is capped at 21 points and overtime dominance at seven points; and
- the final value is 90% schedule/results plus 10% dominance.

Provisional rows exist before Week 7 but are hidden. Beginning in Week 7 the dashboard exposes Power Rank, Résumé Rank, their difference, and disagreement reasons covering schedule, results, dominance, roster-prior influence, or opponent-adjusted performance. Teams with fewer than five games remain ranked and carry a limited-sample flag. No rivalry, championship, bowl, playoff, or human bonus exists.

### Editions and publication

`ratingEditions` stores nightly, official, amendment, and research metadata; `teamRatingSnapshots` stores the corresponding team rows. Both model versions, the probability calibration, cutoff, source-data vintage, and revision travel with the edition. Rows are inserted atomically and never updated. The first official edition for a season/week is frozen. Corrections use a linked amendment, while research reruns use a historical cutoff and cannot become the default published view.

The daily rating job runs only when the synchronized source vintage changed. A Monday job freezes the weekly official edition. Dashboard reads prefer amendments, then official editions, then nightly editions; the old composite and Elo remain bounded migration fallbacks until new editions are built.

## Legacy composite migration fallback

`ratingModel.ts` can still rebuild `cfb26-composite-v2` so existing deployments and historical rows remain readable during migration. It is no longer the active rating direction and its provider inputs never enter `cfb26-power-v1` or `cfb26-resume-v1`.

Every numeric rating is a 0–100 within-season percentile. A 90 means the team scores at or above roughly 90% of that season's modeled teams for that perspective; it does not mean a 90% win probability. Ties receive the same midpoint percentile.

The model stores 16 perspectives:

| Perspective                   | What it measures                                                                                 |   Overall weight |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ---------------: |
| Power                         | Current strength plus recency-weighted prior standings, games, and year-over-year trends         |              26% |
| Offense                       | Efficiency, success, explosiveness, finishing drives, scoring, yards per play, and ball security |              13% |
| Defense                       | Opponent efficiency, success and explosiveness allowed, scoring and yards allowed, and havoc     |              13% |
| Pass offense / pass defense   | Passing PPA, success, explosiveness, yards per attempt, and completion rate                      |        2.5% each |
| Run offense / run defense     | Rushing PPA, success, explosiveness, line yards, stuff rate, power success, and yards per carry  |        2.5% each |
| Situational offense / defense | Standard/passing downs, field position, finishing drives, third downs, turnovers, and havoc      |        2.5% each |
| Special teams                 | SP+/FPI special-teams value plus available kicking, punting, and return results                  |               3% |
| Talent                        | 247 talent, a five-stage recruiting pipeline, and recency-weighted draft capital                 |              12% |
| Continuity                    | Returning PPA and usage across passing, receiving, and rushing                                   |               6% |
| Résumé                        | Record, SRS/SOS, strength of record, game control, quality wins, margins, and championships      |               8% |
| Form                          | Last-five and full-season opponent-adjusted margins, road form, and consistency                  |               4% |
| Tempo                         | Relative pace and play volume                                                                    | Descriptive only |
| Volatility                    | Margin variance and offensive/defensive explosiveness                                            | Descriptive only |

Within each perspective, the model reweights only the signals that exist for that team and season. A wholly unavailable perspective is neutral at 50. That prevents a missing provider field from becoming a zero, while the separate confidence score makes the loss of evidence visible.

## Inputs and coverage

The deterministic builder uses the checked-in database before it uses any external model:

- stored Elo snapshots and pre/postgame Elo;
- standings, record, SRS/SOS, championships, and complete offense/defense per-game splits;
- compact completed games, venue-adjusted margins, opponent quality, recent form, and prior-season program trajectory;
- the rolling five-season detailed game-stat rows, including available efficiency, turnover, havoc, third-down, and special-teams categories;
- five recruiting classes weighted by expected development stage rather than simple recency;
- five draft years weighted by recency, but only when the loaded national window can distinguish feed absence from zero selections.

The credential-gated rating-input sync also requests six official CollegeFootballData sources independently: [CORE, SP+, and FPI](https://api.collegefootballdata.com/api/ratings), [advanced season statistics](https://api.collegefootballdata.com/api/stats), [247Sports Team Talent Composite](https://api.collegefootballdata.com/api/teams), and [returning production](https://api.collegefootballdata.com/api/players). A source can return no preseason data or fail at the account's access tier without blocking the other sources or the deterministic rebuild.

Confidence is source coverage, not predictive certainty. The source weights total 100: games 13, advanced stats 12, Elo 10, CORE 10, SP+ 10, standings 8, detailed game stats 8, FPI 8, recruiting 8, returning production 5, talent 5, and covered draft history 3. Prior standings and games count as evidence from those existing sources rather than inventing a second independent source. Hosted confidence values will change only when the `v2` snapshots are rebuilt.

## Multi-season performance baseline

The power perspective reserves 20% of its internal signal weight for completed program history. The builder loads the selected season plus four earlier seasons without reading future data. Prior seasons receive weights `1.00`, `0.65`, `0.40`, and `0.25`, newest to oldest.

- Standings history contributes recency-weighted SRS and win percentage.
- Game history contributes recency-weighted win percentage and venue/opponent-adjusted margin. Opponent adjustment uses the stored pregame Elo when available, then postgame Elo, then a neutral 1500 fallback.
- Separate least-squares slopes for historical SRS and adjusted margin reward sustained improvement and identify decline. A trend needs at least two prior seasons; otherwise it is missing rather than zero.
- Current-season Elo, standings, games, provider ratings, and last-five form remain separate and carry 80% of the power perspective when every signal exists. Missing signals are still reweighted by the normal coverage rule.

This baseline describes program carryover, not returning-player identity. Current returning production and the recruiting pipeline handle roster continuity separately.

## Recruiting development pipeline

National recruiting rows are class aggregates, so `v2` treats class age as an expected contribution curve rather than pretending every signee remains on the roster:

| Class in selected season | Expected role                                      | Pipeline weight |
| ------------------------ | -------------------------------------------------- | --------------: |
| First year               | Exceptional immediate contributors only            |            0.20 |
| Second year              | Rotation candidates still approaching the jump     |            0.55 |
| Third year               | Largest development jump and roster core           |            1.00 |
| Fourth year              | Leadership and established core                    |            0.85 |
| Fifth year               | Veteran depth and rotation-level starting presence |            0.45 |

Developed class points, average rating, and blue-chip ratio use that curve. Two additional signals preserve the shape that one average cannot express: freshman stud impact is `five-stars + 35% of four-stars` from the current class, while core talent uses only the third- and fourth-year classes. If a source contains duplicate team/class rows, the builder keeps the row with the greatest class points, matching the earlier model.

The national class feed does not identify redshirts, transfers, departures, injuries, or which recruits actually developed. The curve is therefore a transparent prior, not a player-level depth chart.

## NFL draft development signal

Draft output measures recent program development, not talent still on the roster. The selected draft year receives weight `1`; each prior year receives `1 / (years ago + 1)`, so the five-year sequence is `1`, `1/2`, `1/3`, `1/4`, and `1/5`. The talent perspective consumes weighted pick count, source pick value, and rounds 1–3 output.

The builder enables these signals only when the represented draft years average at least 64 national selections. Once that coverage gate passes, every modeled team receives a draft value, including a true zero for no selections. If no covered draft year is present, draft stays missing and the talent perspective reweights around it.

The current hosted `DraftHistoryInput` feed contains valid selections only for 2001–2004. The weighting and zero-selection behavior are active for season windows that overlap those years; modern snapshots omit draft evidence until the upstream source supplies valid recent classes or a replacement feed is approved.

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

The projected margin combines the overall difference, both offense/defense interactions, pass/run/situational interactions, special teams, talent, continuity, résumé, form, and a 2.5-point non-neutral home adjustment. The lower of the two confidence scores shrinks the margin toward zero. Win probability currently uses the explicitly versioned `fixed-logistic-v1` transform of that shrunken margin, capped at 3–97%; the projected total uses both offenses, both defenses, and tempo. The projection accepts a versioned learned logistic calibration after it passes the held-out promotion gate. These values are comparative model estimates and must not be presented as betting lines.

Stored completed meetings since 2000 are displayed as context but do not receive an extra rivalry or series-history weight. That avoids treating games played by different rosters and coaches as current-team evidence.

## Predictive evaluation

The pure backtest boundary uses rolling-origin season folds and rejects any forecast whose feature cutoff is not strictly before kickoff. It reports margin MAE, Brier score, expected calibration error with reliability buckets, and diagnostic winner accuracy overall and by season, week range, favorite strength, venue, and subdivision matchup.

Regularized logistic calibration learns the probability curve from projected margins and completed outcomes in earlier seasons only. A challenger replaces the current model only when it improves aggregate margin MAE and Brier score, avoids material probability-calibration regression, wins both objectives in most comparable seasons, and has no material individual-season regression. See [ADR 0007](../decisions/0007-optimize-predictions-with-held-out-seasons.md).

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
- Recruiting classes are aggregate expectations and cannot observe player-level development, redshirts, retention, or transfer-portal movement.
- Early-season and historical confidence vary with source coverage. Missing values are never imputed as worst-in-class.
- The evaluation and calibration contracts are implemented, but the repository does not yet store historical weekly as-of forecasts. The current formula therefore remains the uncalibrated baseline and no accuracy improvement is claimed yet.

[Back to reference index](README.md)
