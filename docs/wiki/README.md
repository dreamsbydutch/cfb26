# cfb26 wiki

This wiki is the durable source of truth for the application. It describes what exists, why it exists, how to change it, and what remains undecided. [AGENTS.md](../../AGENTS.md) owns concise operating rules; this wiki owns the detail behind them.

## Truth labels

- **Current** — implemented or configured in the repository now.
- **Planned** — an agreed next step that is not implemented.
- **Undecided** — a decision is still required; agents must not invent an answer.

## Find an answer

| Question                                        | Start here                             |
| ----------------------------------------------- | -------------------------------------- |
| What are we building and how far along is it?   | [Product](product/README.md)           |
| How does a request travel through the system?   | [Architecture](architecture/README.md) |
| How do I run, change, or deploy the app?        | [Guides](guides/README.md)             |
| What must pass before handoff or release?       | [Operations](operations/README.md)     |
| What does every folder, command, and config do? | [Reference](reference/README.md)       |
| Why was the current stack chosen?               | [Decisions](decisions/README.md)       |
| What does a project-specific term mean?         | [Glossary](glossary.md)                |

## Current snapshot

**Current:** `cfb26` is a two-route TanStack Start application. `/` is a responsive splash page. `/anotherPage` exercises a sample Convex `numbers` table through a query and action. The app has no product-specific domain model, authentication provider, automated tests, CI workflow, or attached hosting project recorded in the repository.

**Planned:** attach the user-selected Convex deployment, confirm the full local data loop, define the product's user/problem/core workflow, and then build the first vertical feature slice.

**Undecided:** product audience, feature set, data model, authentication policy, authorization model, branding, analytics, and production service-level expectations.

## Documentation map

- [Product](product/README.md)
  - Known end goal, scope boundaries, milestones, and open decisions.
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
