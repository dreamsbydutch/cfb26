# ADR 0009: Use one predictive ranking and three game orders

- Status: Accepted
- Date: 2026-09-02
- Refines: [ADR 0008](0008-separate-power-and-resume-ratings.md)

## Context

The legacy composite exposed many analytical perspectives, and the first Power/Résumé interface preserved a selector between two ranking views. That made supporting evidence look like competing predictive rankings. Weekly games also had one national score that combined matchup caliber and relevance to the playoff chase, preventing users from sorting those questions independently.

## Decision

The public team table has one predictive ordering: CFB26 Power Rank. Each row shows the Power value and its offense, defense, special-teams, home-field, sample-size, prior-influence, and source evidence. Beginning in Week 7, Résumé appears in the same row as supporting record evidence rather than a selectable predictive perspective.

Every weekly game receives three independent 0–100 scores:

1. matchup quality from both teams' Power strength and projected competitiveness;
2. playoff importance from matchup quality plus rank-based playoff leverage and conference context; and
3. Michigan importance from direct participation, scheduled-opponent relationships, and Big Ten context.

The schedule sync enriches games from CFBD `/games/media` when available. Television metadata is optional and cannot fail the core game sync.

## Consequences

- Users can answer “best matchup,” “most important nationally,” and “most important to Michigan” without changing the team-rating definition.
- Résumé remains visible without being mistaken for a second prediction model.
- The playoff score is a documented heuristic, not a playoff-probability simulation.
- The old 16-perspective composite remains readable only as a migration fallback.
