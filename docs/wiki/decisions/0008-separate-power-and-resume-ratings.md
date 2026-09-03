# ADR 0008: Separate Power and Résumé ratings

- Status: Accepted
- Date: 2026-09-02
- Supersedes: [ADR 0004](0004-versioned-multi-perspective-team-rating.md)

## Context

The percentile composite mixed predictive strength, résumé, roster priors, vendor ratings, and descriptive perspectives into one manually weighted number. Its season-level snapshots could not support leakage-safe pregame validation, its 0–100 scale did not express football points, and the same output tried to answer two different questions.

## Decision

Publish two independent systems:

- **CFB26 Power Rating** estimates current neutral-field strength in points above or below an average FBS team. A regularized hierarchical scoring model estimates offense, defense, strongly shrunk special teams, and team-specific home-field advantage. FCS ratings remain hidden but participate in opponent adjustment.
- **CFB26 Résumé Rating** measures wins above the expectation of an average top-25 team. It is calculated provisionally all season and becomes visible in Week 7. Schedule- and venue-adjusted results contribute 90%; capped opponent-adjusted dominance contributes 10%.

SP+, FPI, CORE, Elo, and betting markets do not enter the new model as features. They may be retained solely as out-of-sample benchmarks. Current-season games begin with equal weight; recency and richer preseason features require held-out evidence before official activation.

Persist every build as an immutable edition. Nightly, official, amendment, and research editions carry their cutoff, model/calibration versions, revision, and source-data vintage. The first official edition for a week freezes; a correction creates a linked amendment.

## Consequences

- `teamCompositeRatings` and `ratingModel.ts` remain migration fallbacks, not the active direction.
- `ratingEditions` and `teamRatingSnapshots` preserve historical vintages and distinguish official publication from research reruns.
- The dashboard defaults to Power Rank and shows Résumé Rank and the rank difference beginning in Week 7.
- Missing special-teams or richer preseason data is explicit. It is not imputed as average and does not silently activate an unvalidated feature.
- Learned calibrators and richer model variants must pass the rolling held-out gates in [ADR 0007](0007-optimize-predictions-with-held-out-seasons.md).

[Back to decisions index](README.md)
