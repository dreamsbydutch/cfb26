# Vision and delivery status

[Product index](README.md) · [System definition](system-definition.md) · [Implementation backlog](implementation-backlog.md) · [Wiki home](../README.md)

## End goal

**Current source — approved and implemented 2026-09-06:** CFB26 is a Michigan-first college football intelligence system. Public users explore Michigan player development and alumni outcomes alongside national schedules, ratings, résumés, playoff projections, and matchups. One private owner maintains Michigan facts, participation, and CFB26 Player Grades. The system targets $0 monthly operation and does not expand into a national player archive or general NFL product.

The [system definition](system-definition.md) remains the canonical product contract for audience, scope, grades, source authority, retention, immutable publications, and non-goals.

## Current source experience

- `/` presents the football-ordered Michigan Matrix; canonical companion routes cover readiness/roster evidence, movement, player intelligence, four-player comparison, and alumni.
- `/games` presents chronological national schedules; sibling routes cover the continuous all-FBS Power field, Résumé, deterministic Playoff, team profiles, matchup simulation, identity-blind ballot, and model methodology.
- `/admin/roster` uses revocable 12-hour owner sessions and a desktop workflow shell for Dashboard, Roster, Season, Data, and Operations. Owner writes are transactional, audited, revisioned, and guarded by current-revision backups where destructive.
- Direct CFBD and nflverse adapters retain only required normalized data and preserve the last valid state on source failure.
- PFF source data and code are removed. CFB26 Player Grades are owner-authored, phase-specific, and never mixed with conventional source statistics.
- The 43-table source contract retains immutable editions, forecasts, and submitted ballots while adding owner audit events and a monotonic Michigan data revision around mutable facts.

## Delivery boundary

| Stage                                                  | Status                                              |
| ------------------------------------------------------ | --------------------------------------------------- |
| Product definition                                     | Complete                                            |
| Phases 1–9 source implementation                       | Complete                                            |
| Offline verification                                   | Complete when `npm run check` passes for the change |
| Development data migration and backend synchronization | Complete 2026-09-07                                 |
| Production backend promotion and smoke test            | Complete 2026-09-07; web release not included       |

No major product decision remains open. A richer Power challenger is an evidence-gated model change, not a scope blocker. Deployment scheduling must remain within the free-source/free-allowance operating target.
