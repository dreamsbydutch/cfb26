# ADR 0003: Separate team strength and game importance

- Status: Accepted
- Date: 2026-08-23

## Context

A national ranking and a weekly viewing guide answer different questions. Ranking asks how strong every FBS team is; game importance asks which matchups matter nationally or to Michigan. A single opaque score would hide those distinctions and make Michigan-specific prioritization look like an objective national ranking.

## Decision

Use the latest stored CollegeFootballData Elo snapshot as the transparent first team-strength ranking. Compute app-owned weekly importance separately through two 0–100 scores:

- National importance combines the participating teams' Elo strength and expected competitiveness.
- Michigan importance prioritizes Michigan itself, its season opponents, and the Big Ten race while retaining a smaller national-quality component.

Expose both scores and their relationship label in one bounded weekly query. Let the browser sort the same weekly result through either lens. Keep the exact formulas in [Landscape ranking and game importance](../reference/landscape-ranking.md).

## Consequences

- Users can distinguish “best team” from “most important game.”
- Michigan remains the editorial center without distorting the national ranking.
- The first ranking inherits CFBD Elo's methodology and coverage; it is not yet a proprietary composite.
- Importance does not yet model playoff odds, standings leverage, rivalry, media reach, injuries, or betting markets.
- Formula changes are observable product changes and require synchronized documentation.

[Back to architecture decisions](README.md)
