# Additional win/loss signal in Power

[Reference index](README.md) · [Three team ratings](three-team-ratings.md)

**Research result, September 14, 2026:** the tested additional win/loss component received zero learned weight in every held-out season and in the final fit. All margin forecasts remained identical to released Power v6. No candidate passed promotion; no production model or team ranking was changed.

## Experiment

The owner asked whether winning should provide additional predictive evidence beyond adjusted margin and efficiency, following Texas's recorded 24–23 home win over Ohio State. We tested three prespecified responsiveness levels of a results-only Elo component alongside the existing margin/efficiency foundation and validated Program v4 history feature. Elo uses the result, opponent rating, and venue; a one-point win and a blowout produce the same update given the same pregame ratings. Its update rates were 12, 24, and 48; offseason retention was 0.8 and home-field value 55 Elo points. These internal settings are explicit research choices, not learned coefficients.

Each season fits component point calibration and nonnegative sum-to-one ensemble weights on earlier seasons. Combined probabilities use earlier cross-fitted ensemble forecasts. The comparison covers the same 6,888 games in eight outer seasons, 2018–2025, with earlier warm-up forecasts. FCS point predictions retain the incumbent fallback. The unchanged promotion gates compare against the released Power v6 ensemble, not merely its older foundation. SP+ and FPI are not inputs.

An initial screening reused the foundation's restricted point-scale calibration and all three Elo variants hit its 1.5 upper limit. Those results were treated as provisional. The final experiment uses an unrestricted least-squares point scale and venue offset fitted only on earlier forecasts. Final scales were 3.7904, 2.5565, and 1.8244 for K=12, 24, and 48 respectively. A regression test verifies recovery of a scale and offset beyond the foundation limits and rejection of future training evidence.

## Results

| Model             | Added win/loss weight | Margin MAE |    Brier | Early-season MAE | Early-season Brier |
| ----------------- | --------------------: | ---------: | -------: | ---------------: | -----------------: |
| Released Power v6 |                     — |  12.821778 | 0.163485 |        13.408951 |           0.125464 |
| Win/loss, K=12    |                    0% |  12.821778 | 0.163485 |        13.408951 |           0.125464 |
| Win/loss, K=24    |                    0% |  12.821778 | 0.163485 |        13.408951 |           0.125464 |
| Win/loss, K=48    |                    0% |  12.821778 | 0.163485 |        13.408951 |           0.125466 |

Every outer-season fit assigned zero weight, not only the final 2026 fit. The final mixture retained 90.7342% foundation and 9.2658% Program history. Exact per-game margins match the incumbent. Probabilities also match exactly for K=12 and K=24; K=48's separately refitted probability calibration changes slightly, including a very small aggregate Brier improvement below the table's displayed precision, but worse early-season Brier. No candidate passed the strict improvement gates.

The [evaluation artifact](power-win-loss-evaluation-2026-09-14.json) also reports 896 forecasts after a team's most recent same-season win by 1–3 points and 192 after exactly one-point wins. The previous game must be available before the forecast cutoff and within 21 days of the upcoming game. Each upcoming game counts once. Margin errors remain identical. For K=48, post–one-point-win Brier moves from 0.151352 to 0.151364, while the broader narrow-win Brier moves from 0.172979 to 0.172976. These tiny mixed changes do not establish predictive improvement.

This supports retaining the current Power forecast rather than assigning an extra win bonus by hand. It does **not** prove that every alternative result signal is useless, or that Texas's current rating is perfectly calibrated. These are reused development seasons with reconstructed historical source availability, not untouched prospective evidence. The experiment learns blend weights for this component family; it does not optimize every underlying model parameter. Résumé's larger reward for actually winning remains a separate merit policy.

## Reproduce

```bash
node scripts/evaluate-power-ensemble.mjs enriched.json incumbent-v5-foundation.json benchmarks released-with-forecasts.json program-v4-context.json --retain-forecasts
node scripts/evaluate-power-ensemble.mjs enriched.json incumbent-v5-foundation.json benchmarks win-loss-k12.json program-v4-context.json --retain-forecasts --win-loss-k=12
node scripts/evaluate-power-ensemble.mjs enriched.json incumbent-v5-foundation.json benchmarks win-loss-k24.json program-v4-context.json --retain-forecasts --win-loss-k=24
node scripts/evaluate-power-ensemble.mjs enriched.json incumbent-v5-foundation.json benchmarks win-loss-k48.json program-v4-context.json --retain-forecasts --win-loss-k=48
node scripts/summarize-win-loss-testing.mjs enriched.json released-with-forecasts.json benchmarks new-summary.json win-loss-k12.json win-loss-k24.json win-loss-k48.json
```

The summary verifies source and forecast fingerprints before scoring. Output files refuse overwrites. The existing Elo tests verify score-margin invariance, past-only observations, same-cutoff freezing, and neutral symmetry; ensemble tests verify learned weights, complete cohort alignment, and cross-fitted probability calibration.
