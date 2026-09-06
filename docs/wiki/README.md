# cfb26 wiki

This wiki is the durable source of truth for the application. It describes what exists, why it exists, how to change it, and what remains undecided. [AGENTS.md](../../AGENTS.md) owns concise operating rules; this wiki owns the detail behind them.

## Truth labels

- **Current** — implemented or configured in the repository now.
- **Planned** — an agreed next step that is not implemented.
- **Undecided** — a decision is still required; agents must not invent an answer.

## Find an answer

| Question                                         | Start here                                              |
| ------------------------------------------------ | ------------------------------------------------------- |
| What are we building and how far along is it?    | [Product](product/README.md)                            |
| How does a request travel through the system?    | [Architecture](architecture/README.md)                  |
| How do I run, change, or deploy the app?         | [Guides](guides/README.md)                              |
| How do I publish completed work as a preview PR? | [Preview pull requests](guides/preview-pull-request.md) |
| What must pass before handoff or release?        | [Operations](operations/README.md)                      |
| What does every folder, command, and config do?  | [Reference](reference/README.md)                        |
| Why was the current stack chosen?                | [Decisions](decisions/README.md)                        |
| What does a project-specific term mean?          | [Glossary](glossary.md)                                 |

## Current snapshot

**Current:** `cfb26` is a three-route TanStack Start application. `/` is a responsive Michigan football personnel explorer; `/games` combines one evidence-rich Power ranking, Week 7 Résumé context, separate matchup-quality/playoff/Michigan game orders, optional television outlets, and custom matchup projections; `/admin/roster` is a no-index, deployment-key-gated movement desk whose in-season edit surface is limited to jersey number, position, and depth placement, alongside complete recruit/transfer/walk-on arrivals and history-preserving departures. Checked-in source has the 21-table immutable rating-edition contract, but it has not been pushed: development still hosts the prior 19-table composite model and production remains on the earlier 17-table, 47,774-document foundation. The owner-confirmed Vercel project and production domain are recorded, but the Nitro-backed web deployment still needs a production smoke check. The repository has offline CFBD and rating-model tests, but no identity provider or CI workflow.

**Planned:** the approved [CFB26 system definition](product/system-definition.md) expands the current slice into a Michigan-first intelligence system with public read-only exploration and one private owner. Delivery starts with the backed-up schema/PFF/OpenSheet migration in [phase 1](product/implementation-backlog.md#phase-1--schema-and-controlled-migration), proceeds through national, roster, player-game, rating, ranking, NFL, and operational workflows, and ends with the final UI redesign.

**Undecided:** the single-owner authentication mechanism, any Power challenger that can pass held-out promotion gates, free-tier scheduling details, and final visual language remain later engineering selections. No unresolved product decision blocks phase 1.

## Documentation map

- [Product](product/README.md)
  - Approved system definition, current/end-state vision, scope boundaries, and phase backlog.
- [Architecture](architecture/README.md)
  - System flow, frontend, and Convex backend.
- [Guides](guides/README.md)
  - Local setup, feature delivery, and deployment.
- [Operations](operations/README.md)
  - Verification, releases, security, and secret handling.
- [Reference](reference/README.md)
  - Repository map, configuration, commands, and current public contracts.
- [Decisions](decisions/README.md)
  - Architectural decision records (ADRs).

## Keeping the wiki trustworthy

Update the owning page in the same change that modifies a route, function contract, table, command, dependency boundary, environment variable, deployment behavior, or agreed product direction. Keep historical rationale in an ADR. Run `npm run docs:check` before handoff.
