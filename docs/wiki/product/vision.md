# Vision and delivery status

[Product index](README.md) · [System definition](system-definition.md) · [Implementation backlog](implementation-backlog.md) · [Wiki home](../README.md)

## End goal

**Current source — approved and implemented 2026-09-06:** CFB26 is a Michigan-first college football intelligence system. Public users explore Michigan player development and alumni outcomes alongside national schedules, ratings, résumés, playoff projections, and matchups. One private owner maintains Michigan facts, participation, and CFB26 Player Grades. The system targets $0 monthly operation and does not expand into a national player archive or general NFL product.

The [system definition](system-definition.md) remains the canonical product contract for audience, scope, grades, source authority, retention, immutable publications, and non-goals.

## Current source experience

- `/` presents Michigan season rosters from 2015 onward with position-room, scholarship, eligibility, roster-limit, development, returning-production, grade, profile, comparison, and alumni views.
- `/games` presents national schedules and results, CFB26 Power and Résumé evidence, schedule strength and quadrants, deterministic playoff projections, team profiles, matchup simulation, and the identity-blind all-FBS owner ballot.
- `/admin/roster` uses revocable 12-hour owner sessions and covers commitments, enrollment, multiple stints, Player Seasons, departures, evaluations, draft/NFL outcomes, Player Games, imports, identity repair, season rules, backups, rollover, and source/data health.
- Direct CFBD and nflverse adapters retain only required normalized data and preserve the last valid state on source failure.
- PFF source data and code are removed. CFB26 Player Grades are owner-authored, phase-specific, and never mixed with conventional source statistics.
- The 41-table backend contract retains immutable editions, forecasts, and submitted ballots while keeping owner-authored mutable facts overwrite-oriented.

## Delivery boundary

| Stage                                                  | Status                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| Product definition                                     | Complete                                                    |
| Phases 1–9 source implementation                       | Complete                                                    |
| Offline verification                                   | Complete when `npm run check` passes for the change         |
| Development data migration and backend synchronization | Complete 2026-09-07                                         |
| Production backend promotion and smoke test            | Complete 2026-09-07; web release not included               |

No major product decision remains open. A richer Power challenger is an evidence-gated model change, not a scope blocker. Deployment scheduling must remain within the free-source/free-allowance operating target.
