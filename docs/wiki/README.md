# cfb26 wiki

This wiki is the durable source of truth for the application. [AGENTS.md](../../AGENTS.md) owns concise operating rules; this wiki owns product, architecture, operations, and historical detail.

## Truth labels

- **Current source** — implemented in the working repository contract.
- **Hosted current** — verified in a named deployment.
- **Planned** — agreed but not implemented.
- **Undecided** — requires a product decision.

## Current snapshot

**Current source:** the nine-phase Michigan-first system is implemented across three context shells. `/` opens the Matrix, with canonical Michigan Overview, Movement, Alumni, player, and comparison routes. `/games` opens chronological national schedules, with canonical complete-field Power, Résumé, Playoff, Teams, Simulator, Blind Ballot, and Methodology routes. `/admin/roster` leads a desktop Owner Dashboard plus an inline-editable Roster, explicit Player Stats entry, Data, and Operations workflows. Direct CFBD and nflverse boundaries replace intermediary/proprietary ingestion. Michigan owner writes now advance a data revision and durable audit trail; destructive workflows require a backup manifest for that exact revision.

**Hosted current:** development `adjoining-opossum-710` and production `doting-chipmunk-7` received the 41-table contract in a backed-up, exact-target cutover on 2026-09-07. Michigan v2 counts and representative public reads were reconciled in both environments. The 43-table source delta and final-form web UI have not been deployed; see the [cutover record](operations/convex-v2-cutover-2026-09-07.md).

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
