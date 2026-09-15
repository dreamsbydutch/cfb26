# Power factor experiments

[Reference index](README.md) · [Three team ratings](three-team-ratings.md)

**Research result, September 14, 2026:** seventeen variants and controls screened six proposed improvement areas against released Power v6. Returning passing continuity was the most promising factor, but none passed every promotion gate. Live Power, Program, and Résumé ratings are unchanged.

## Results

Lower margin MAE and Brier are better. The [verified evaluation artifact](power-factor-evaluation-2026-09-14.json) contains all annual folds, source fingerprints, learned fits, coverage, and rejection reasons.

| Candidate                           |    Margin MAE |        Brier | Weeks 1–4 MAE | Weeks 1–4 Brier |
| ----------------------------------- | ------------: | -----------: | ------------: | --------------: |
| Released Power v6                   |     12.821778 |     0.163485 |     13.408951 |        0.125464 |
| Repeated surprise, two games        |     12.829745 |     0.163550 |     13.425741 |        0.125583 |
| Repeated surprise, three games      |     12.825404 |     0.163397 |     13.433102 |        0.125560 |
| Recent-error control                |     12.827731 |     0.163492 |     13.422577 |        0.125522 |
| Balanced PPA control                |     12.821778 |     0.163485 |     13.408951 |        0.125464 |
| Faster offense                      |     12.821791 |     0.163486 |     13.408924 |        0.125464 |
| Faster defense                      |     12.821778 |     0.163485 |     13.408951 |        0.125464 |
| Success rate                        |     12.817577 |     0.163447 |     13.401178 |        0.125557 |
| Points per drive                    |     12.821778 |     0.163485 |     13.408951 |        0.125464 |
| Opponent uncertainty, PPA           |     12.821778 |     0.163485 |     13.408951 |        0.125464 |
| Opponent uncertainty, surprises     |     12.829739 |     0.163542 |     13.425825 |        0.125582 |
| Joint original-archive factors      |     12.826728 |     0.163489 |     13.422037 |        0.125684 |
| Explosiveness                       |     12.821778 |     0.163485 |     13.408951 |        0.125464 |
| Returning passing continuity        | **12.808578** | **0.163456** | **13.368890** |    **0.125325** |
| Turnover differential               |     12.815277 |     0.163532 |     13.382893 |        0.125422 |
| Return-score margin                 |     12.814011 |     0.163529 |     13.377054 |        0.125388 |
| Combined turnover/return correction |     12.815738 |     0.163531 |     13.384252 |        0.125425 |
| Recalibration without a new factor  |     12.812171 |     0.163538 |     13.370326 |        0.125373 |

Returning passing continuity improved the aggregate metrics and early-season checks, but improved both MAE and Brier in only **four of eight seasons**: 2018, 2019, 2022, and 2023. The gate requires a majority. Its overall margin improvement was only 0.0132 points per game, and only 0.003593 points beyond the no-factor recalibration control. It is the first follow-up candidate, not a justified production replacement.

Success rate also slightly improved overall margin and probability accuracy, but worsened early-season Brier and failed the annual consistency requirement. Turnover and return-score corrections improved margin errors while worsening overall Brier; their margin gains were smaller than recalibration alone. The response-rate, points-per-drive, explosiveness, and opponent-uncertainty variants did not establish useful additional predictive value in these implementations. Several received zero learned contribution; displayed equality does not imply every unrounded probability is identical.

No candidate was promoted, and no fixed bonus or new percentage was added to Power. The next useful evidence would be a fresh, untouched or prospectively collected evaluation of the passing-continuity feature, with dated starter/availability information, followed by success-rate calibration work.

## What was tested

| Area                                    | Implemented experiment                                                                                                              | Limits                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Adaptive historical confidence          | Correct the forecast after two or three consecutive same-direction prediction errors; compare an unrestricted recent-error control  | Screens repeated-surprise adaptation, not a direct replacement of the historical prior's confidence calculation         |
| Separate offense/defense responsiveness | Independent opponent-adjusted PPA models with offense/defense season retention of 0.25/0.75 and 0.75/0.25; balanced 0.5/0.5 control | Changes the response rate of an additional component, not the published core's unit priors                              |
| Quarterback continuity                  | Learn a residual point correction from returning passing usage and returning passing PPA share                                      | Team passing continuity proxy; no verified starter identities, in-season starter changes, injuries, or availability     |
| Turnover/special-teams volatility       | Learn corrections from current-season drive-ending turnover differential, recognized return-score margin, and both together         | No total fumble opportunities, recovery-luck calculation, or complete special-teams EPA                                 |
| Richer competitive efficiency           | Independent opponent-adjusted success rate, explosiveness, and competitive points per drive                                         | Points per drive does not measure finishing-drive opportunities; actual red-zone/finishing-drive counts remain untested |
| Opponent uncertainty                    | Reduce observation precision for opponents with less established FBS evidence, in both PPA and repeated-surprise models             | Experience-based precision proxy, not a fitted posterior uncertainty model                                              |

A joint model combines six prespecified signals from the original archive. A separate no-factor recalibration control tests whether extra calibration flexibility alone explains apparent gains. No manual blend percentages are assigned.

## Evaluation design

The runner first reconstructs the released ensemble from its saved foundation and Program v4 components and requires exact agreement with all incumbent margins and probabilities. It then evaluates the same 6,888 games in 2018–2025, including 2,221 regular-season games in Weeks 1–4. Earlier 2015–2017 forecasts supply training and warm-up data.

Every forecast freezes before its weekly slate. A previous result becomes eligible only after kickoff plus six hours. Independent point scales and venue offsets are learned without the foundation's restrictive scale caps. Nonnegative sum-to-one blend weights use earlier seasons, and probability calibration uses earlier cross-fitted combined forecasts. Quarterback and volatility residual coefficients also exclude their forecast season. FCS matchups retain the foundation margin fallback in additional components.

The unchanged promotion gates require improvements in overall margin MAE and Brier score, sufficiently consistent annual results, early-season MAE and Brier, and early-season MAE on the same opening-line benchmark games. Rank agreement with another system is not the target. SP+ and FPI are not model inputs.

Internal research choices remain explicit: efficiency models use a three-season window, capped observation counts, and ridge shrinkage; repeated-surprise errors are capped at 21 points and respect the existing censored blowout/overtime treatment. Opponent precision is `min(1, sqrt((discounted FBS-opponent games + 1) / 12))`. Returning passing PPA share is bounded to [-2, 2] before fitting; returning passing usage must be between zero and one. These are limited screens, not an exhaustive search of each model family.

Explosiveness initially failed the positive-scale calibration requirement in earlier training data. Its final screen therefore allows the point-scale direction to be learned from earlier seasons. This explicit exception does not change the other factors or the existing Elo calibration contract. A regression test verifies signed fitting and future-season rejection.

## Data and limitations

The frozen baseline archive contains 20,690 games and 3,277 season profiles. Additional read-only CFBD downloads cover 2013–2025: `/player/returning`, `/stats/game/advanced` with garbage time excluded, and `/drives`. They add 1,552 matched returning-production records, 27,138 matched team-game explosiveness observations, and 337,887 matched drives. Three returning records and 324 advanced records could not be matched to the frozen game identities; they are excluded without fuzzy matching.

Returning passing data is present for both teams in 5,927 evaluation games. Drive records cover 6,883 evaluation games, and both-side explosiveness covers 6,879. Missing inputs remain missing rather than being invented from final scores. Ambiguous `FUMBLE TD` labels are excluded from turnover/return-score attribution; recognized return scores also require a valid score change of six to eight points.

These are **reused development seasons with reconstructed historical availability**. The source records were fetched in 2026, not archived at each pregame cutoff. Historical returning-production revisions and missing live availability cannot be ruled out. Opening spreads are also archived without quote timestamps. Passing a development screen would justify further validation, not establish a prospective accuracy guarantee. Failure does not prove that every implementation of a factor is useless.

## Reproduce

Use ignored local files for source data and supply `CFBD_API_KEY` through the environment. The download helper makes read-only API requests, preserves the fetch timestamp, and resumes matching cached files without overwriting them. Evaluation output directories must be new.

```bash
node scripts/evaluate-power-ensemble.mjs enriched.json foundation.json benchmarks reproduced.json program-v4-context.json --retain-forecasts --save-components=components.json
node scripts/fetch-power-factor-evidence.mjs extra-evidence 2013 2025
node scripts/evaluate-power-factors.mjs enriched.json components.json released-with-forecasts.json benchmarks factor-results extra-evidence
node scripts/summarize-power-factors.mjs released-with-forecasts.json benchmarks new-summary.json factor-results
```

For an individual diagnostic, append `--only=recalibrated-foundation-control` after the supplementary evidence directory and use a new output directory. The summary helper can combine disjoint result directories; it verifies source, benchmark, and per-candidate forecast fingerprints and re-scores predictions before applying promotion gates.

The offline tests cover cutoff leakage, same-slate freezing, neutral symmetry, censored blowouts, overtime, actual response-rate effects, exact source identity joins, return-score direction, duplicate evidence, learned coefficient recovery, and future-season training rejection.
