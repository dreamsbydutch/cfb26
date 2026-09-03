# ADR 0007: Optimize predictions with held-out seasons

## Status

Accepted.

## Context

The checked-in matchup projection uses hand-authored weights and a fixed logistic conversion from projected margin to win probability. Full-season ratings cannot be evaluated against earlier games in that same season without leaking future results. Winner accuracy alone would also reward poorly calibrated confidence and conceal the size of margin misses.

## Decision

Use rolling-origin, season-held-out evaluation. Every forecast must record a feature cutoff strictly before kickoff. Fit each probability calibrator only on seasons before its evaluation season.

Model selection has two co-primary objectives: lower out-of-sample margin mean absolute error and lower Brier score, with expected calibration error reported separately. Winner accuracy remains diagnostic. Report results by held-out season, week range, predicted favorite strength, venue, and FBS/FCS composition.

A challenger must improve aggregate margin MAE and Brier score, avoid a material calibration regression, improve both objectives in most comparable seasons, and avoid a material single-season regression. Do not collapse the objectives into one blended score. Use regularized logistic margin calibration as the first learned probability mapping; a more flexible calibrator must defeat it under the same gates.

## Consequences

- `ratingBacktest.ts` is the pure evaluation boundary and `npm run test:ratings` protects its contract.
- The existing matchup probability mapping is explicitly versioned as `fixed-logistic-v1` and remains the baseline until historical pregame forecasts select a trained replacement.
- Existing season-level snapshots are not valid backtest predictions. Weekly as-of snapshots or equivalent pregame feature artifacts are required before claiming an accuracy improvement.
- Promotion is deliberately conservative: an aggregate gain cannot hide an unstable held-out season.

[Back to decisions index](README.md)
