# cfb26 wiki

This wiki is the durable source of truth for the application. [AGENTS.md](../../AGENTS.md) owns concise operating rules; this wiki owns product, architecture, operations, and historical detail.

## Truth labels

- **Current source** — implemented in the working repository contract.
- **Hosted current** — verified in a named deployment.
- **Planned** — agreed but not implemented.
- **Undecided** — requires a product decision.

## Current snapshot

**Current source:** the nine-phase Michigan-first system is implemented across three route shells. `/` covers 2015-forward season rosters, room/scholarship/eligibility/development views, four-player comparisons, CFB26 Player Grades, profiles, and alumni NFL summaries. `/games` covers national schedules, Power, Résumé, schedule strength/quadrants, playoff projection, program profiles, hypothetical matchups, and the all-FBS blind ballot. `/admin/roster` provides revocable single-owner sessions and the Michigan lifecycle, Player Season, Player Game, evaluation, identity, NFL-gap, import, rollover, backup, and health workflows. Direct CFBD and nflverse boundaries replace intermediary/proprietary ingestion.

**Hosted current:** neither recorded Convex deployment has received this source/schema migration. Development and production retain their previously documented contracts until an exact-target, backed-up cutover is separately authorized and verified. No production behavior should be inferred from source status.

**Undecided:** no major product decision is open. A richer Power challenger can become official only after it passes the recorded held-out performance and calibration gate.

## Find an answer

| Question                          | Start here                                          |
| --------------------------------- | --------------------------------------------------- |
| What is the product?              | [Product](product/README.md)                        |
| What is implemented?              | [Current contracts](reference/current-contracts.md) |
| How does data move?               | [Architecture](architecture/README.md)              |
| How do I run or deploy it?        | [Guides](guides/README.md)                          |
| What must pass before release?    | [Operations](operations/README.md)                  |
| Why were these boundaries chosen? | [Decisions](decisions/README.md)                    |
| What does a term mean?            | [Glossary](glossary.md)                             |

## Documentation map

- [Product](product/README.md) — system definition, vision, and phase record.
- [Architecture](architecture/README.md) — frontend and Convex flow.
- [Guides](guides/README.md) — local setup, delivery, and controlled deployment.
- [Operations](operations/README.md) — verification, releases, recovery, and secrets.
- [Reference](reference/README.md) — repository, configuration, and public contracts.
- [Decisions](decisions/README.md) — architectural decision records.

Update the owning page with code changes and run `npm run docs:check` before handoff.
