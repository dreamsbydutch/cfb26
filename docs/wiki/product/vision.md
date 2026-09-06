# Vision and end goal

[Product index](README.md) · [System definition](system-definition.md) · [Implementation backlog](implementation-backlog.md) · [Wiki home](../README.md)

## End goal

**Planned — approved 2026-09-06:** Build CFB26 as a Michigan-first college football intelligence system. Public users explore Michigan player development and alumni outcomes alongside national schedules, ratings, résumés, playoff projections, and matchups. One private owner maintains Michigan facts, participation, and CFB26 Player Grades. The system targets $0 monthly operation and does not expand into a national player archive or general NFL product.

The [system definition](system-definition.md) is the canonical product contract. It resolves the intended audience, public/private boundary, Michigan and national scope, grade semantics, source authority, retention, immutable publications, and explicit non-goals. The final visual redesign follows stable functional workflows rather than leading them.

## Current experience

**Current**

- `/` presents the 2026 depth chart and progressively loads recruiting, career, movement, draft, seasonal PFF, and NFL summary fields for 428 player records.
- Users browse the current roster by depth, recruiting class, NFL entry class, exact position, 2015–2025 legacy snap/PFF season, or searchable player index.
- `/games` uses stored 2000–2026 games to present one points-scale Power order, Week 7 Résumé evidence, three game-importance orders, optional television outlets, and venue-aware matchups.
- `/admin/roster` supports narrowly protected current-stint placement plus recruit/transfer/walk-on arrival and departure workflows.
- Checked-in source has 21 tables and the Power/Résumé edition contract, but development and production remain on earlier deployed contracts described in [Current contracts](../reference/current-contracts.md).

The legacy PFF/OpenSheet/schema behavior above remains a current fact, not approved future behavior. Phase 1 removes or migrates it only after a verified export and dry run. Public browsing still defaults to development, roster writes still use the transitional key in [ADR 0005](../decisions/0005-single-owner-roster-admin-key.md), and production deployment remains separately controlled.

## Delivery status

| Stage                | Status       | Exit condition                                                                                                          |
| -------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Technical foundation | **Complete** | App, checks, documentation structure, and agent workflows exist.                                                        |
| First vertical slice | **Current**  | Michigan browsing, limited roster administration, national games, and initial ratings work end to end.                  |
| Product definition   | **Complete** | Scope, domain behavior, authority, retention, non-goals, and delivery order are approved.                               |
| Phases 1–8           | **Planned**  | Stable schema, workflows, national intelligence, alumni NFL tracking, and operations satisfy each phase exit condition. |
| Phase 9 redesign     | **Planned**  | Stable functionality is redesigned and passes end-to-end/accessibility checks.                                          |

The [implementation backlog](implementation-backlog.md) owns phase details and dependencies.

## Remaining selections

No unresolved product decision blocks domain work. These later implementation selections remain intentionally open inside the approved boundary:

- which private single-owner authentication mechanism replaces the transitional deployment key;
- which richer Power challenger, if any, passes held-out promotion gates;
- the exact free-tier scheduling and cache mechanisms; and
- the phase 9 visual language.

Changing the Michigan-only player archive, public read/private owner boundary, $0 target, source authority, immutable-output rules, or explicit non-goals requires a new product decision.
