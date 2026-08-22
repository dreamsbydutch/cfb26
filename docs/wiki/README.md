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

**Current:** `cfb26` is a one-route TanStack Start application. `/` is a responsive Michigan football personnel explorer backed by the hosted development deployment. It exposes all 428 players through current depth-chart, recruiting-class, draft-class, exact-position, search, and detailed profile views. Development and production contain the same eight-table schema and 3,084 documents as verified on 2026-08-22; production still has no deployed functions. The app has no authentication provider, automated tests, CI workflow, or attached Vercel project recorded in the repository.

**Planned:** review the recovered schema/public-read source against the hosted contract, recover or deliberately retire the internal legacy-import functions, validate a development push when explicitly authorized, then connect the deployment pipeline. Define the product audience, longer-term problem statement, and production data-access policy.

**Undecided:** product audience, edit workflows, authentication policy, authorization model, final branding, analytics, and production service-level expectations.

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
