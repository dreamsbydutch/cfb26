# Program context in Power and Résumé

[Reference index](README.md) · [Three team ratings](three-team-ratings.md)

**Current source:** Power v6 includes a learned prior-season Program forecast. Résumé v5 adds bounded opponent context and the owner's explicitly approved own-history bonus. Program v4 itself is unchanged. Current-season achievements never enter these historical components.

## Predictive evidence

The [evaluation artifact](program-context-evaluation-2026-09-13.json) compares the same 6,888 games in eight outer seasons, 2018–2025. Earlier seasons train the Program-to-strength mapping, component point calibration, nonnegative sum-to-one ensemble weights, and final symmetric logistic probability curve. Probability fitting uses earlier ensemble forecasts whose weights excluded their own season. The existing promotion gate accepted the candidate with no failed safeguards.

| Metric                  |  Power v5 | Power with Program |
| ----------------------- | --------: | -----------------: |
| Margin MAE              | 12.844823 |          12.821778 |
| Brier score             |  0.163680 |           0.163485 |
| Early-season margin MAE | 13.433302 |          13.408951 |
| Early-season Brier      |  0.125794 |           0.125464 |

These are small gains on reused model-development seasons, not proof of a large or statistically significant improvement on untouched future games. Historical personnel availability and membership are reconstructed. Older conference accomplishments remain incomplete. SP+ and FPI are not inputs, and no stale external ranking can affect this blend.

The released 2026 weights are 0.9073416609447099 for calibrated v5 Power and 0.09265833905529011 for the calibrated Program forecast, learned from 8,635 earlier forecasts. The Program component uses scale 1.0931991166723183 and home offset 0.15456797531503463. The combined probability slope is 0.1180020563, fitted on 7,762 earlier cross-fitted forecasts. Release coefficients are in `convex/powerProgramRelease.ts`; the earlier-season Program mappings are in `convex/programContextRelease.ts`.

The final forecast adds the Program adjustment equally to offense and defense; it is overall strength context, not separately measured unit production. It never feeds back into recursive Power history or Program's annual performance fits. FCS matchups retain the base point forecast, matching the evaluated fallback, while using the combined probability curve. Missing Program history uses a neutral component. Coefficients apply from 2026 onward until a validated annual refit replaces them.

## Résumé policy

Own-history credit is `0.15 * max(0, (priorProgramRating - 50) / 50)` once the team has won a game. It adds at most 0.15 win-equivalents once per season total. Unknown or below-average history earns no bonus. This is a declared merit preference, not a fitted predictive coefficient. It can favor the stronger historical program when earned résumés are very close.

FBS opponent strength receives half a game of prior-season Program evidence, mapped into point units using earlier-season targets. Current-season results dilute it. Each evaluated team's own games and own prior are excluded from its opponent fit. The 70/30 results/performance allocation, win/loss sign protections, and Week 7 publication gate remain intact. The [ADR amendment](../decisions/0013-three-independent-team-ratings.md) records the approved change from the original pure-current-season policy.

## Reproduction

```bash
node scripts/prepare-program-context.mjs enriched.json games.jsonl drafts.jsonl new-program-context.json
node scripts/evaluate-power-ensemble.mjs enriched.json incumbent-v5.json benchmarks new-evaluation.json new-program-context.json
```

The preparer reconstructs Program before each season from results, personnel evidence, and verified modern accomplishments since 2000. Annual strength targets exclude incomplete 2026. The evaluator rejects missing FBS context and mismatched source fingerprints. Both commands refuse to overwrite their output. The artifact retains input and forecast hashes, annual coefficients, fold metrics, and selection decisions; local source archives are not committed.

Run `npm run test:ratings` for the forecast leakage/calibration suite and `npm test` for the bonus, blending, date cutoff, FCS fallback, and complete repository tests.

The [development verification](program-context-verification-2026-09-13.json) reproduces every published team's Power value and own-history bonus from the same dated source slices. All 138 match exactly, Program scores/ranks remain unchanged at the same cutoff, and the largest current bonus is 0.113 win-equivalents. This artifact identifies a development edition; historical prediction evaluation remains the separate evidence above.
