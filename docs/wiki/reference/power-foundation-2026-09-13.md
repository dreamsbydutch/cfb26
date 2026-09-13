# Power forecast foundations: September 13, 2026

[Reference index](README.md) · [Three team ratings](three-team-ratings.md)

## Status

**Current source:** Power v5 selects censored blowout treatment plus a half-weight learned roster adjustment. It passes the existing eight-season gate and the additional early-season checks. The full-margin Huber and continuous-efficiency alternatives remain research-only. Program and Résumé retain their independent models.

The [evaluation artifact](power-foundation-evaluation-2026-09-13.json) records every corrected replay decision, season-fold result, benchmark comparison, and source fingerprint. The selected model jointly improves margin and probability scores in most seasons, without relaxing any existing safeguard.

| Metric, 2018–2025                            | Incumbent | Power v5 |
| -------------------------------------------- | --------: | -------: |
| Overall margin MAE, 6,888 games              |   12.9382 |  12.8448 |
| Overall Brier score                          |   .165145 |  .163680 |
| Weeks 1–4 margin MAE, 2,221 games            |   13.5606 |  13.4333 |
| Weeks 1–4 Brier score                        |   .127697 |  .125794 |
| Opening-line matched early MAE, 1,392 games  |   13.6705 |  13.4861 |
| Archived-line matched early MAE, 2,183 games |   13.5674 |  13.4374 |

Lower is better. Opening-market MAE is **12.3418** and archived-market MAE is **12.2997** on their respective shared samples, so the model still trails both benchmarks. A full-weight roster alternative improved aggregate scores but failed the 2019 calibration safeguard; raising prior confidence to six or eight games did not pass all gates. These modest gains do not establish SP+ parity.

## Blowout treatment

The v4 fit treats a 60-point regulation win as an exact 35-point margin. Against an expected margin of 43, this creates a negative residual even though the team exceeded expectations. Positive global calibration cannot repair that ordering error.

`powerMargin.ts` provides two alternatives. Huber fitting preserves the regulation margin and limits the influence of unusually large prediction errors. Censored fitting interprets a margin above the cap as a lower bound: a 60-point win says at least 35, rather than exactly 35. If the expected margin is already 43, the censored score contributes no adverse residual. An actual 35-point win remains an exact observation. Home and away treatment is symmetric. Overtime retains the seven-point cap. Efficiency and score evidence are treated independently; credible efficiency evidence can still disagree with the final score.

The continuous-efficiency challenger also replaces the abrupt 30-play availability threshold with a reliability ramp over 60 plays per team. It is a separate experimental option, not a declaration that low-volume efficiency is equally reliable.

## Roster forecast

`powerRoster.ts` learns the following season's strength from previous-season opponent-adjusted strength, team talent, recruiting points, returning offensive usage, and the interaction between returning usage and prior strength. Separate availability indicators distinguish missing evidence from observed average or zero production. Talent and recruiting are normalized independently within the season's FBS field; a source needs at least 80% field coverage. No conference or brand rank targets are inserted.

The nine-coefficient ridge model requires at least 200 earlier team seasons. Each forecast year's coefficients use only targets from preceding seasons. The strength target is an independent season fit with raw regulation margins, a 21-point Huber threshold, fixed 2.5-point home advantage, and the existing 20% efficiency blend. The preseason adjustment is bounded to eight raw rating points before applying the policy's blend weight. Team-wide talent adjustments split evenly between offense and defense; verified offensive continuity still controls offensive prior confidence. This does not invent defensive returners, coaching changes, transfer quality, injuries, or quarterback availability.

The research dataset adds available 2013–2016 recruiting, 2014–2016 returning usage, and 2015–2016 talent to the existing 2017–2026 profiles. Missing source years remain missing. Historical roster and advanced statistics were retrieved retrospectively. Past-only target training prevents outcome leakage between folds, but this is **not** a vintage archive proving which roster values were available on each historical forecast date.

The production fit now visits teams in the same canonical program order as the replay; iteration order must not introduce rounding differences between evaluated and published forecasts.

Historical continuity previously expired at the research fit's administrative March cutoff. The replay now evaluates personnel validity at the final included game for past seasons; current-season evidence still obeys the actual forecast cutoff. A regression test compares the year-to-year replay with the production calculation using non-average returning production.

## Evaluation and promotion

The dataset contains full FCS schedules for opponent adjustment. Forecasts freeze before each weekly slate. The first evaluation season, 2017, supplies initial calibration training; eight folds from 2018 through 2025 are scored. Each fold's point-scale and probability calibration use earlier forecasts only. The final season is not used to train itself.

The existing gate requires lower mean season-fold margin MAE and Brier score, joint improvement in most seasons, no material fold regression, and acceptable calibration. `chooseEarlyPowerChampion` additionally requires improvement in weeks 1–4 margin MAE and Brier, identical early-season games and cutoffs, and improvement in model MAE on games with opening-market benchmarks. Beating the incumbent on those games does not mean beating the market. The winner must pass every gate; an attractive ranking screenshot is not an acceptance test.

Candidate choices were iterated after inspecting these historical folds. Reported scores are development evidence, not an untouched final holdout or a statistically established accuracy gain. Earlier runs before the historical-continuity repair are superseded and are excluded from promotion.

## External benchmarks

Historical opening and archived provider spreads come from [CFBD betting data](https://api.collegefootballdata.com/api/betting). Providers receive equal weight through the median; home spreads are negated to obtain predicted home margins. Missing opening quotes are not filled with later lines. Only shared games are scored. Quotes lack timestamps, so an archived spread is not asserted to be a closing line, and this comparison is not an equal-information betting test.

SP+ supplies an independent prospective benchmark through [CFBD ratings](https://api.collegefootballdata.com/api/ratings). The [frozen September 13 forecasts](power-sp-forecasts-2026-09-13.json) cover 115 upcoming FBS-versus-FBS games through week 4. They use the observed neutral rating difference plus an explicitly assumed 2.5-point home effect. These are derived margins, not published Connelly game picks. No SP+ win probabilities are fabricated. No outcomes were available when frozen; season-end SP+ values must never substitute for missing historical weekly snapshots.

## Reproduction

Run from the repository root with a local enriched model-data export. Outputs refuse overwrites. Only the fetch command needs `CFBD_API_KEY`, provided through the environment; do not put credentials in arguments or commit raw environment files.

```bash
node scripts/fetch-power-benchmarks.mjs path/to/benchmark-directory 2017 2025
node scripts/evaluate-power-foundation.mjs path/to/enriched.json path/to/new-evaluation.json
node scripts/compare-power-benchmarks.mjs path/to/new-evaluation.json path/to/benchmark-directory path/to/new-market-report.json
node scripts/select-power-foundation.mjs path/to/benchmark-directory path/to/new-selection.json path/to/incumbent-report.json path/to/challenger-report.json
node scripts/freeze-sp-benchmark.mjs path/to/model-data.json path/to/observed-sp.json path/to/new-frozen-forecasts.json
node scripts/score-sp-benchmark.mjs path/to/frozen-forecasts.json path/to/scored-model-forecasts.json path/to/new-sp-score.json
```

The evaluator accepts an optional policy index for isolated runs. The selector requires the incumbent report first, identical source-data fingerprints, and distinct model versions. The SP+ scorer accepts only matching games whose snapshot predates the model cutoff and kickoff, reports pending/unmatched games, and reports observation-time differences. Raw inputs and full forecast files stay in ignored local storage; compact results and source fingerprints belong in this reference record.

## Release validation

Development edition `q172syt202vx3qfbx83nn7a5eh8eb5a6` contains 266 modeled teams and 138 published FBS teams. All 138 Power ratings and ranks exactly match the calibrated offline replay. Power is v5; Program remains v3 and Résumé v4. The 95 offline tests, TypeScript, ESLint, local Markdown links, and production build pass. Development was backed up before deployment.
