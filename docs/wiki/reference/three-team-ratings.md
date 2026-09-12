# Three team ratings

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** independent Program, Power, and Résumé edition fields, publication controls, and complete-field views. This page owns the numerical contract under [ADR 0013](../decisions/0013-three-independent-team-ratings.md). Source availability and model promotion limits below are material parts of the contract.

## Program

`cfb26-program-v1` is a 0–100 index with components for competitive results (70%), acquisition (20%), and development (10%). These are explicit initial policy weights, not learned forecasting coefficients.

The ten season weights, newest first, are `1, .85, .70, .55, .40, .15, .12, .09, .06, .03`. Results weights are multiplied by `min(games / 12, 1)`, preventing a hot September from counting as a full season. Verified acquisition/development evidence uses full season weights and can update the ranking during the offseason before games begin. Results come from independently fitted, opponent-adjusted season strength transformed by `100 / (1 + exp(-strength / 10))`. Newcomers' thin results shrink toward the neutral estimate until 1.5 effective season weights exist.

Acquisition uses within-season midrank percentiles of roster talent, falling back to recruiting points. It activates only with at least 80% field coverage. It does not add talent and recruiting together. Development uses draft selections weighted `1 + (8 - min(round, 7)) / 7`; at least 150 national picks must be present before treating absent program selections as true zeros. Draft output measures development, not talent still on the roster.

Missing components remain null in the evidence display. A neutral estimate fills their fixed score allocation, so merely adding average-valued coverage earns no extra points. Coverage is observed weighted evidence divided by the ten-season maximum; the displayed uncertainty index is `5 + 25 × (1 - coverage)`, an evidence diagnostic, **not** a statistical confidence interval. No-history teams remain included with explicit low coverage.

## Power

The active `cfb26-power-v1` baseline retains the existing robust, opponent-adjusted points model and five-season recursive history. It caps its prior at eight effective games and weights current-season games equally. Its prior-weight display is a diagnostic ratio rather than an exact decomposition of influence.

`powerResearch.ts` implements offseason-transition and 60-/120-day recency challengers. Turnover evidence can reduce prior confidence when observed before the cutoff. Reconstructed weekly forecasts freeze before the week's first kickoff, with a conservative six-hour completion buffer for earlier games. `npm run ratings:evaluate -- <model-data.json> <new-report.json>` evaluates exported model data, refuses to overwrite reports, and applies the eight-season promotion gate. It never changes the deployed model automatically.

The [2026-09-12 evaluation artifact](power-evaluation-2026-09-12.json) records 6,843 games across eight complete held-out seasons (2017–2023 and 2025), with 2013–2016 reserved initially for history. The strict completed-schedule filter excluded 2024 and the ongoing 2026 season. None of the challengers passed the promotion gate:

| Policy                    | Margin MAE | Brier score | Calibration error |
| ------------------------- | ---------: | ----------: | ----------------: |
| Active baseline           |     14.977 |     .185198 |           .029387 |
| Four-game offseason prior |     15.118 |     .182274 |           .018776 |
| 60-day recency            |     15.648 |     .187514 |           .026729 |
| 120-day recency           |     15.348 |     .185262 |           .019270 |

Lower is better. The transition policy improved probability metrics but worsened margin error, including early-season margin error. These reconstructions use retained results, not original pregame source snapshots, and do not establish that the incumbent is globally optimal. The artifact includes input fingerprint, fold results, early-season diagnostics, and rejection reasons.

Regular and postseason slates are evaluated separately even when the provider restarts week numbering. Postseason forecasts use completed regular-season evidence and do not enter early-season diagnostic buckets.

**Coverage limit:** national coaching changes, transfer retention, and injuries are not yet verified consistently across the field. The published baseline is explicitly results-based, not fully availability-aware. Personnel evidence and recency remain research inputs until reliable coverage and promotion evidence exist. No paid source or manual national injury workflow is silently introduced.

## Résumé

`cfb26-resume-v2` is current-season merit in win-equivalent units. Its fixed reference is +14 points relative to average FBS strength, with a fixed 2.5-point venue effect and the versioned baseline logistic curve. This is an explicit contender standard, not a weekly moving average of the current top 25.

Opponent strength is refitted from the selected season's games **without historical priors or personnel adjustments**. Each evaluated team's own games are excluded from its opponent-strength fit: otherwise a convincing win can depress its opponent's rating and perversely reduce the winner's credit. Opponents with little independent evidence remain uncertain and regularized.

For each game, let `p` be the reference team's expected win probability, `w` the actual result (1 win, 0 loss, .5 historical tie), and `d` the logistic transform of capped margin. Regulation dominance caps at 21 points; overtime caps at seven.

- Results credit: `w - p`.
- Winning performance credit: `(1 - p) × (2d - 1)`.
- Losing performance credit: `-p × (2 - 2d)`.
- Historical tie performance credit: `.5 - p`.
- Final score: `70% × sum(results credit) + 30% × sum(performance credit)`.

Every win earns positive credit and every loss negative credit. Dominance matters more against difficult opposition and cannot turn a loss into positive credit. Weak blowouts earn little. Teams within the same .01-win-equivalent score bucket use mini head-to-head win/loss balance, then lower expected wins, more actual wins, and stable identity. Tied groups are evaluated together to avoid cyclic sort comparators.

Game-control and game-specific personnel enrichment are not available. The system therefore cannot yet distinguish late cosmetic scoring or reconstruct which injured players participated. These limitations are exposed rather than imputed. Schedule Power/quadrants elsewhere in the app remain predictive context; they are not inputs to the independent Résumé score.

## Membership and publication

The CFBD FBS directory sync records a season-bounded classification, including independent programs, in `programAffiliations`. Edition builds prefer that directory and include members without completed games. Before that sync, the existing schedule-derived field is explicitly labeled. Unknown identities must not silently truncate an official field. Edition storage validates consecutive ranks and unique team identities.

Directory batches carry a source timestamp and expected field size; an incomplete batch set cannot become the authoritative directory. `teamData.syncFbsDirectory` refreshes just that bounded directory. `teamData.syncAll` accepts a scoped `sources` selection for recruiting and draft backfills, avoiding unrelated polling or identity refreshes. Source-vintage changes trigger new editions, and a build aborts if its sources change during calculation.

New optional fields preserve old snapshots. Original editions are never rewritten to invent a Program rating. Current views choose the newest cutoff across nightly, official, and amendment editions; frozen weekly views retain the first official edition. `/national/program` and `/national/resume` expose search, conference filters, evidence, and current/weekly/selection/final views.

Fresh visits default to the latest published week; explicit URL weeks select historical views, and the Week control can return to Latest. Publication weeks continue beyond the final regular-season week through the postseason rather than restarting at provider Week 1. The Games view uses the same publication calendar, so the Résumé gate stays open and postseason games remain reachable.

Selection is detected when all regular-season games are complete and scheduled postseason games have not begun. The first non-research selection edition freezes. Final status requires the complete known postseason schedule to be finished. Incomplete source schedules limit this detection; an internal build can specify the stage explicitly. No retrospective build should be represented as an original selection-day publication.

Résumé is public entering Week 7; zero-game and limited-sample teams stay in the complete field. Program and Résumé behavior tests cover history isolation, future-data rejection, dominance, losses, newcomers, coverage neutrality, and 138-team inclusion. Forecast accuracy is assessed separately from these contract tests.

## Development verification, 2026-09-12

The backed-up development deployment built an edition with 238 modeled teams and exactly 138 published FBS teams. The confirmed season directory, consecutive Program/Power ranks, and pre-Week-7 Résumé gate were verified through live queries. Scoped CFBD context refreshes supplied 2017–2026 recruiting/talent and 253–262 draft selections per year. All 138 current programs have acquisition and development evidence; combined coverage ranges from 12% for thin-history members to 85% with the incomplete current season.

Desktop and 390px mobile browser checks verified the full Program table, search, no page overflow, the Résumé opening gate, and Power's missing-edition state without page errors. National personnel and competitive-game-control coverage remain the explicit limitations described above.
