# Three team ratings

[Reference index](README.md) · [Wiki home](../README.md)

**Current source:** independent Program, Power, and Résumé edition fields and complete-field views. Each public ranking page presents its named system for the selected season and week; immutable publication snapshots remain a data-retention contract rather than alternate rating types. This page owns the numerical contract under [ADR 0013](../decisions/0013-three-independent-team-ratings.md). Source availability and model promotion limits below are material parts of the contract.

Ranking tables show football ratings rather than model diagnostics. Power shows rank, team/conference, Power, offense, and defense; special teams appears only when the selected edition has a separately rated special-teams component. Program shows its rating plus results, acquisition, and development. Résumé shows its rating, wins, results credit, performance credit, and season strength. Prior weights, source notes, coverage, uncertainty, and sample-size explanations remain outside table columns; the backend retains them for validation and methodology.

Ranking pages use short page titles and publication timestamps. Repeated model introductions, version identifiers, and evidence/limitations footers are omitted from the browsing views; Methodology retains the model explanations and coverage limits. The Week 7 opening message and unavailable-edition states remain visible when relevant.

## Program

`cfb26-program-v3` is a 0–100 index with components for competitive results (70%), acquisition (20%), and development (10%). These are explicit policy weights, not learned forecasting coefficients. Version 3 retains subdivision-adjusted season strength and the component weights.

The ten season weights follow `0.74 ** age`: each older season receives 26% less weight, without a cliff after year five. Results weights are multiplied by `min(games / 12, 1)`, preventing a hot September from counting as a full season. Verified acquisition/development evidence uses full season weights and can update the ranking during the offseason before games begin. Results come from independently fitted, opponent-adjusted season strength transformed by `100 / (1 + exp(-strength / 10))`. Newcomers' thin results shrink toward the neutral estimate until 1.5 effective season weights exist.

Acquisition normalizes roster talent and recruiting points separately into within-season midrank percentiles, then falls back from talent to recruiting. Each source requires at least 80% field coverage; raw scores from different scales are never mixed. Development uses draft selections weighted `1 + (8 - min(round, 7)) / 7`; at least 150 national picks must be present before treating absent program selections as true zeros. When all three preceding roster-talent percentiles exist, draft output receives `0.2 * clamp(output - mean(prior three talent percentiles), -25, 25)`. This changes the development component by at most five points and is an exposure proxy rather than causal coaching attribution. Missing cohorts retain absolute output.

Missing components remain null in the evidence display. A neutral estimate fills their fixed score allocation, so merely adding average-valued coverage earns no extra points. Coverage is observed weighted evidence divided by the ten-season maximum; the displayed uncertainty index is `5 + 25 × (1 - coverage)`, an evidence diagnostic, **not** a statistical confidence interval. No-history teams remain included with explicit low coverage.

## Power

The active `cfb26-power-v4` uses opponent-adjusted points and five-season recursive history. Current-season games have equal calendar weight. Historical carryover starts at four effective games, down from eight in v2, and two when crossing from FCS to FBS. Verified offensive continuity can reduce those weights further. Prior weights are diagnostics rather than exact decompositions of influence: ridge regularization, opponent fitting, and subdivision pooling also contribute.

Regulation margins still cap at 35 points and overtime margins at seven, but capped margins now keep full residual weight. A result is no longer discounted a second time merely because it strongly contradicts the prior. Offense/defense estimates retain their robust score-residual weights and reconcile to the final margin strength. The starting estimate is not additionally regressed every offseason; available evidence supported lighter confidence rather than a mandatory strength reduction. Program and Résumé retain their independent season fits and versions.

FCS opponents shrink toward a pooled subdivision estimate, not average FBS strength. Each margin-fit iteration estimates that location from completed cross-subdivision games, adjusting for the FBS opponent and venue and using the same capped scores and evidence weights as the fit. With no cross-subdivision games, available FCS priors supply the location; without either source it remains neutral and uncertain. Unit estimates receive the subdivision adjustment before reconciliation to neutral margin strength.

The history map retains the last observed season when a team disappears from an imported schedule. Each intervening missing season halves the departure from its previous subdivision's population mean. A transitioning team retains its FCS-scale evidence when joining the public FBS field, with a lighter two-game weight reflecting the change of competition. A completely unknown FBS member receives a neutral population prior with four effective games, rather than an unusually permissive zero-history fit. At the beginning of the history window, an FCS team with no observed population has zero prior weight: an assumed zero must not masquerade as average-FBS evidence. Strong observed transition evidence can still support a high rating; there are no team-name, conference-name, or rank-ceiling rules. Sources identify population priors, coverage gaps, and subdivision transitions.

The importer fetches FCS schedules independently, including FCS-versus-FCS results. Games against lower classifications are excluded. Only FBS members appear in the public field and forecast evaluation. Missing advanced evidence retains score-based fitting; missing imported games still do not imply no history.

`powerResearch.ts` retains archived offseason-transition and 60-/120-day recency challengers. Turnover evidence can reduce prior confidence when observed before the cutoff. Reconstructed weekly forecasts freeze before the week's first kickoff, with a conservative six-hour completion buffer for earlier games. `npm run ratings:evaluate -- <model-data.json> <new-report.json>` preserves the archived v3-versus-v2 comparison, refuses to overwrite reports, and applies the eight-season promotion gate. The enriched runner below evaluates v4. Neither runner changes the deployed model automatically. Production and research share carryover and margin-fit settings; regression tests reconstruct both paths identically. Research includes all policy settings in its historical-cache key.

The original [2026-09-12 evaluation artifact](power-evaluation-2026-09-12.json) records 6,843 games across eight complete held-out seasons (2017–2023 and 2025), with 2013–2016 reserved initially for history. The strict completed-schedule filter excluded 2024 and the ongoing 2026 season. None of the original recency/turnover challengers passed the promotion gate:

| Policy                    | Margin MAE | Brier score | Calibration error |
| ------------------------- | ---------: | ----------: | ----------------: |
| Retired v1 baseline       |     14.977 |     .185198 |           .029387 |
| Four-game offseason prior |     15.118 |     .182274 |           .018776 |
| 60-day recency            |     15.648 |     .187514 |           .026729 |
| 120-day recency           |     15.348 |     .185262 |           .019270 |

Lower is better. The transition policy improved probability metrics but worsened margin error, including early-season margin error. These reconstructions use retained results, not original pregame source snapshots, and do not establish that the incumbent is globally optimal. The artifact includes input fingerprint, fold results, early-season diagnostics, and rejection reasons.

The subsequent [subdivision correction evaluation](power-subdivision-evaluation-2026-09-12.json) compares v2 against the unchanged v1 reconstruction on the same 6,843 games. V2 passed the existing promotion gate: margin MAE **13.648970** versus **14.977159**, Brier **.169163** versus **.185198**, and calibration error **.017349** versus **.029387**. Early-season margin error improved from 18.179 to 14.659 points. The principal gain is in games involving FCS opponents. On 6,002 FBS-versus-FBS games, margin MAE was essentially unchanged (13.398 versus 13.399) while Brier improved from .187450 to .185553.

The 24-game early-transition cohort is a material limitation: margin error and winner accuracy were essentially unchanged, but Brier worsened from .170228 to .234179. Conservative point estimates are not evidence of well-calibrated newcomer probabilities. Two-game transition priors performed better than heavier alternatives during screening; the final initialization fix improved the overall field but did not solve transition probability calibration. All screening used the same retained held-out seasons. These are model-selection reconstructions, not an untouched prospective test, proof of future accuracy, or complete FCS coverage.

The [responsiveness evaluation](power-responsiveness-evaluation-2026-09-12.json) screened seven alternatives against v2 on the same 6,843 games. The selected four-game carryover with full capped-margin weight passed all existing promotion gates. Margin MAE improved from **13.648970 to 13.471445**, Brier from **.169163 to .165989**, and early-season MAE from **14.658765 to 14.523479**. Calibration error increased slightly from .017349 to .018755, within the pre-existing tolerance. Two-game carryover alternatives failed the 2019 fold safeguard and were rejected. The artifact retains every screening decision, fold metrics, policy parameters, and source fingerprint. These reused historical seasons support model selection, not a claim of untouched prospective validation. UMass remains near the bottom after one win; the policy increases responsiveness for every team without a prescribed rank or a team-specific override.

Regular and postseason slates are evaluated separately even when the provider restarts week numbering. Postseason forecasts use completed regular-season evidence and do not enter early-season diagnostic buckets.

Version 4 blends 80% capped margin with 20% competitive per-play efficiency margin where both teams have at least 30 observed plays. The efficiency margin is `65 * (home PPA - away PPA)`, capped at 35, and enters the opponent-adjusted fit. Home-field fitting uses a stable 2.5-point base; final margin scaling and a venue correction are learned jointly from earlier-season forecasts. All published point components scale together, and projections use the edition's calibrated probability curve. Historical priors stay in unscaled fitted units.

Verified offensive returning usage reduces prior confidence: overall effective games multiply by `.75 + .25 * share`, offensive confidence by `.5 + .5 * share`, and defensive confidence stays unchanged. Passing/receiving usage is averaged when both exist; otherwise total offensive returning usage is used. Missing data leaves the prior unchanged. National coaching changes, incoming transfer production, defensive continuity, and injuries remain unverified.

The [improvement evaluation](power-improvements-evaluation-2026-09-12.json) records 6,888 games across 2018–2025, reserving 2017 forecasts for initial calibration. Every fold calibrates using earlier seasons only. The selected combination passed the unchanged eight-season gate: margin MAE **13.456548 → 12.938275**, Brier **.167160 → .165174**, and calibration error **.020863 → .014125**. An efficiency-only alternative failed and remains research-only. The final 2017–2025 calibrator applies only to editions from 2026 onward.

Run `node scripts/evaluate-rating-improvements.mjs <enriched-data.json> <new-report.json>` to reproduce the comparison against the frozen v3 policy. Advanced-game observation times and preseason personnel availability are explicitly reconstructed. These reused seasons support model selection, not untouched prospective validation. The daily evidence sync preserves actual observation times for live editions.

## Résumé

`cfb26-resume-v4` is current-season merit in win-equivalent units. Its fixed reference is +14 points relative to average FBS strength, with a fixed 2.5-point venue effect and the versioned baseline logistic curve. This is an explicit contender standard, not a weekly moving average of the current top 25. Version 4 retains the subdivision correction using only the selected season's independent opponent evidence; it does not import Power's historical or population priors.

Opponent strength is refitted from the selected season's games **without historical priors or personnel adjustments**. Each evaluated team's own games are excluded from its opponent-strength fit: otherwise a convincing win can depress its opponent's rating and perversely reduce the winner's credit. Opponents with little independent evidence remain uncertain and regularized.

For each game, let `p` be the reference team's expected win probability, `w` the actual result (1 win, 0 loss, .5 historical tie), and `d` the logistic transform of capped margin. Regulation dominance caps at 21 points; overtime caps at seven.

- Results credit: `w - p`.
- Winning performance credit: `(1 - p) × (2d - 1)`.
- Losing performance credit: `-p × (2 - 2d)`.
- Historical tie performance credit: `.5 - p`.
- Final score: `70% × sum(results credit) + 30% × sum(performance credit)`.

Every win earns positive credit and every loss negative credit. Dominance matters more against difficult opposition and cannot turn a loss into positive credit. Weak blowouts earn little. Teams within the same .01-win-equivalent score bucket use mini head-to-head win/loss balance, then greater full-record difficulty, lower expected wins, more actual wins, and stable identity. Full-record difficulty is `-log10(P(reference team wins at least this many games))`, computed from the complete independent-game win distribution; it breaks near ties without changing the 70/30 score. Tied groups are evaluated together to avoid cyclic sort comparators.

When both teams have at least six competitive regulation possessions, performance uses the difference in net points per drive, standardized to twelve possessions. Drives beginning beyond 38/28/22-point leads in quarters two/three/four, overtime, kneels, and end-of-half/game drives are excluded. The actual win/loss fixes the sign of performance credit; control cannot convert a loss into positive credit. Other games retain capped final margins. Game-specific personnel availability remains unknown. Schedule Power/quadrants elsewhere in the app remain predictive context; they are not inputs to the independent Résumé score.

## Membership and publication

The CFBD FBS directory sync records a season-bounded classification, including independent programs, in `programAffiliations`. Edition builds prefer that directory and include members without completed games. Before that sync, the existing schedule-derived field is explicitly labeled. Unknown identities must not silently truncate an official field. Edition storage validates consecutive ranks and unique team identities.

Directory batches carry a source timestamp and expected field size; an incomplete batch set cannot become the authoritative directory. `teamData.syncFbsDirectory` refreshes just that bounded directory. `teamData.syncAll` accepts a scoped `sources` selection for recruiting and draft backfills, avoiding unrelated polling or identity refreshes. Source-vintage changes trigger new editions, and a build aborts if its sources change during calculation.

New optional fields preserve old snapshots. Original editions are never rewritten to invent a Program rating. Current views choose the newest cutoff across nightly, official, and amendment editions; frozen weekly views retain the first official edition. `/national/program` and `/national/resume` expose search, conference filters, evidence, and current/weekly/selection/final views.

Fresh visits default to the latest published week; explicit URL weeks select historical views, and the Week control can return to Latest. Publication weeks continue beyond the final regular-season week through the postseason rather than restarting at provider Week 1. The Games view uses the same publication calendar, so the Résumé gate stays open and postseason games remain reachable.

Selection is detected when all regular-season games are complete or have sourced cancellation evidence and scheduled postseason games have not begun. The first non-research selection edition freezes. Final status requires the complete known postseason schedule to be resolved. Null scores alone never imply cancellation. The confirmed 2024 Appalachian State–Liberty cancellation permits that season to enter evaluation. Incomplete source schedules still limit detection; an internal build can specify the stage explicitly. No retrospective build should be represented as an original selection-day publication.

Résumé is public entering Week 7; zero-game and limited-sample teams stay in the complete field. Program and Résumé behavior tests cover history isolation, future-data rejection, dominance, losses, newcomers, coverage neutrality, and 138-team inclusion. Forecast accuracy is assessed separately from these contract tests.

## Development verification, 2026-09-12

The backed-up development deployment built an edition with 238 modeled teams and exactly 138 published FBS teams. The confirmed season directory, consecutive Program/Power ranks, and pre-Week-7 Résumé gate were verified through live queries. Scoped CFBD context refreshes supplied 2017–2026 recruiting/talent and 253–262 draft selections per year. All 138 current programs have acquisition and development evidence; combined coverage ranges from 12% for thin-history members to 85% with the incomplete current season.

Desktop and 390px mobile browser checks verified the full Program table, search, no page overflow, the Résumé opening gate, and Power's missing-edition state without page errors. National personnel and competitive-game-control coverage remain the explicit limitations described above.

The subsequent subdivision correction passed 71 offline tests, lint/typechecking, documentation links, and the production build. Development accepted the final code and built edition `q1750r3f51qs0qz27ejwgf56ws8e8cf9`: 238 modeled teams, 138 consecutively ranked FBS members, Week 2 with Résumé closed, NDSU #95 and Utah #11. This edition uses Power v2, Program v2, and Résumé v3; earlier immutable editions retain their original models and values.

The responsiveness release validated development edition `q17b2r16hkxh0rwt68xygjzjm58e8e7x`: 238 modeled teams, all 138 FBS members published, Power v3, Program v2, and Résumé v3 with the Week 7 gate closed. Against the retained production source, every Program score/rank and every Résumé numerical score was unchanged. UMass moved from Power #138 (-15.49) to #137 (-12.83), while Program remained #138. Cross-deployment Résumé tie ranks are not compared because document identities differ.

The improvement release validated development edition `q17d3kvwmx64mvmn54ys8e3rw98e88k6`: 266 modeled teams, 138 published FBS teams, Power v4, Program v3, and Résumé v4. Backfilled FCS and competitive evidence spans 2013–2026 in development. All 86 offline tests, TypeScript, lint, documentation links, and production build passed; ranking pages passed desktop/390px browser checks. Program and Power ranks are consecutive, Résumé remains closed in Week 2, and neutral/home/away projections use the same calibrated edition. Fuller FCS history moves NDSU to Power #42; JMU is #31, Utah #12, and UMass #136 while Program remains #138. These are model outputs, not prescribed rank targets.
