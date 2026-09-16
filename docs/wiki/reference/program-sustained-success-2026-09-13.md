# Sustained exceptional Program success

[Reference index](README.md) · [Three team ratings](three-team-ratings.md)

**Current source:** Program v6 strengthens the existing results component after consecutive exceptional seasons. There is still one Program rating. Its raw 0–100 results, acquisition, development, and honors components are weighted 50/20/10/20, and the modern-era trophy ledger remains intact. This is a declared prestige policy, not a claim that extra prestige predicts future wins.

## Rule

Only seasons preceding the selected season qualify. Each must have at least ten games and an opponent-adjusted performance score above 75. A season's confirmation is `clamp((performance - 75) / 15, 0, 1)`. A verified conference title or playoff appearance supplies a minimum confirmation of 0.5, but cannot rescue performance at or below 75. Confirmation is multiplied by `min(games / 12, 1)` so shortened schedules contribute less. No title stage supplies extra points through this adjustment.

For each consecutive pair, calculate its mean performance and take the weaker season's confirmation. The candidate results lift is:

```text
min(16, max(0, pairMean - originalResults))
  * weakerConfirmation
  * 0.74 ** (selectedSeason - newerPairSeason - 1)
```

Only the strongest candidate counts. Overlapping pairs never stack. The lift changes the existing 0–100 results component, so its contribution to the overall Program score cannot exceed eight points. A single breakout season, two nonconsecutive breakouts, weak opponents producing non-elite adjusted performance, and an early current-season streak cannot establish this baseline. The adjustment declines by 26% per year when the underlying evidence and baseline are held fixed, within the existing ten-season results window. Established programs receive less uplift when their original results component already reflects the same level of sustained success.

The overall rating contribution remains in optional snapshot field `programSustainedResults` for audits. It is not another public ranking or a table column. Program's existing Results column includes the adjustment.

## Prediction boundary

The [eight-season comparison](program-sustained-power-evaluation-2026-09-13.json) rebuilt prior-season Program scores, relearned the mapping and ensemble weights, and calibrated probabilities using earlier seasons. It compares 6,888 identical games from 2018–2025 against the released Power v6 ensemble. The revised input failed the existing overall, early-season, and matched-market improvement gates. Reused development seasons and reconstructed historical availability remain limitations.

Power v6 and Résumé v5 therefore continue using the explicitly versioned **Program v4 history feature** and its existing mapping, rather than silently substituting a new score scale. Their previously approved small history influence remains present. The public Program ranking uses v6, which retains the v5 sustained-results rule under the revised 50/20/10/20 prestige allocation. Current-season accomplishments never enter either historical context. This boundary prevents a prestige-policy change from automatically changing validated forecasts or playoff-merit scores.

## Reproduction and verification

```bash
node scripts/prepare-program-context.mjs enriched.json games.jsonl drafts.jsonl new-v5-context.json
node scripts/prepare-program-context.mjs enriched.json games.jsonl drafts.jsonl archived-v4-context.json --program-v4
node scripts/evaluate-power-ensemble.mjs enriched.json incumbent-v5-foundation.json benchmarks old-ensemble.json archived-v4-context.json --retain-forecasts
node scripts/evaluate-power-ensemble.mjs enriched.json incumbent-v5-foundation.json benchmarks candidate-ensemble.json new-v5-context.json --retain-forecasts
node scripts/compare-power-ensembles.mjs old-ensemble.json candidate-ensemble.json benchmarks new-comparison.json
```

The comparison checks matching source fingerprints and retained forecast hashes before applying the existing gates. The historical v4 context archive is identified by hash in the original [Program-context evaluation](program-context-evaluation-2026-09-13.json). All output commands refuse overwrites.

Focused tests cover consecutive-season requirements, sample limits, ordinary versus exceptional results, trophy deduplication, the eight-point cap, gradual fading, unchanged component allocations, and the frozen v4 feature. The [field verification](program-sustained-verification-2026-09-13.json) records all 138 same-cutoff Program changes and confirms Power and Résumé remain unchanged. Indiana moves from #12 to #9; the top eight retain their order. These are consequences of the common rule, not rank targets.
