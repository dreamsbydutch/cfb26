# ADR 0004: Build a versioned multi-perspective team rating

- Status: Accepted
- Date: 2026-08-23

## Context

Elo alone gives one useful strength estimate, but it cannot explain whether an edge comes from offense, defense, style, roster quality, continuity, résumé, or current form. Directly averaging raw source values would also make incomparable units and missing historical coverage look precise.

## Decision

Build a deterministic, versioned CFB26 rating snapshot from season-relative percentiles. Preserve raw provider signals separately from derived ratings, group correlated evidence into named perspectives, reweight within a perspective when a signal is absent, and publish an independent source-coverage confidence score. Keep team strength separate from weekly game importance as established by [ADR 0003](0003-separate-team-strength-and-game-importance.md).

Head-to-head projections compare complementary units instead of subtracting only two overall ratings. Venue changes the projection, while stored series history is context rather than a current-strength input. Tempo and volatility remain descriptive and do not improve the overall rating merely by being high.

## Consequences

- Formula changes require a new `modelVersion` and regenerated snapshots; old results must not silently change meaning.
- Missing data becomes neutral inside an affected perspective and lowers confidence instead of becoming a zero.
- Provider models may inform the composite, but the grouping, normalization, weights, matchup interactions, and uncertainty behavior remain owned by CFB26.
- Predictions are explainable model estimates, not betting lines, and require held-out backtesting before any accuracy claim.

[Back to architecture decisions](README.md)
