# cfb26 wiki

This wiki is the durable source of truth for the application. [AGENTS.md](../../AGENTS.md) owns concise operating rules; this wiki owns product, architecture, operations, and historical detail.

## Truth labels

- **Current source** — implemented in the working repository contract.
- **Hosted current** — verified in a named deployment.
- **Planned** — agreed but not implemented.
- **Undecided** — requires a product decision.

## Current snapshot

**Current source:** the nine-phase Michigan-first system is implemented across three context shells. `/` opens the Matrix, with canonical Michigan Overview, Movement, Alumni, player, and comparison routes. `/games` opens chronological national schedules, with canonical complete-field Power, Résumé, Playoff, Teams, Simulator, Blind Ballot, and Methodology routes. `/admin/roster` leads a desktop Owner Dashboard plus an inline-editable Roster, explicit Player Stats entry, Data, and Operations workflows. Direct CFBD and nflverse boundaries replace intermediary/proprietary ingestion. Michigan owner writes now advance a data revision and durable audit trail; destructive workflows require a backup manifest for that exact revision.

**Hosted current:** development `adjoining-opossum-710` validated the backward-compatible 43-table rating contract on 2026-09-12, including a 138-team public field. Production `doting-chipmunk-7` retains the [2026-09-07 audited data cutover](operations/convex-v2-cutover-2026-09-07.md) as its migration baseline; main-branch delivery uses the Convex-first Vercel build. The manifest-retirement migration was not run for the ratings work.

**Undecided:** no major product decision is open. The three-rating design is approved under [ADR 0013](decisions/0013-three-independent-team-ratings.md). Richer Power challengers still require the held-out performance and calibration gate; national personnel coverage remains limited.

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
