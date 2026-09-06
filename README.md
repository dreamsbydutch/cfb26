# cfb26

`cfb26` is a Michigan football personnel and national landscape explorer built with TanStack Start and Convex. Today it presents the current depth chart, recruiting and draft classes, legacy 2015–2025 snap/PFF data, one points-scale CFB26 Power ranking with supporting evidence, weekly game orders, optional TV outlets, and custom head-to-head matchups.

The approved destination is a Michigan-first college football intelligence system with public read-only exploration, private single-owner administration, owner-authored CFB26 Player Grades, national Power/Résumé/playoff tools, and Michigan-alumni NFL tracking. Phase 1 will remove PFF and OpenSheet dependencies through a controlled migration; those changes are not implemented yet.

## Quick start

Requirements: Node.js 22.12+ and npm.

```bash
npm install
npm run dev:web
```

The browser defaults to the public Michigan development deployment. Set `VITE_CONVEX_URL` in an ignored `.env.local` only to use another compatible deployment. Use `npm run dev` when authenticated Convex source synchronization is intended. See [Deployment](docs/wiki/guides/deployment.md).

## Roster administration

`/admin/roster` separates three active-roster tasks: maintain depth/eligibility/availability, add a recruit/transfer/walk-on with a complete arrival record, or close a Michigan stint with a recorded departure. Additions create the canonical player, recruiting profile, roster stint, career summary, and arrival event atomically; removals retain player history. Writes are disabled until the selected Convex deployment has the checked-in functions and a high-entropy key:

```powershell
npx convex env set CFB26_ADMIN_KEY
npx convex dev --once
```

The first command prompts for the value so it does not enter shell history; the second pushes the checked-in functions and activates the changed typed environment. Confirm the intended development deployment before running either command. Enter that same value on the admin page. Keep it out of tracked files and `VITE_*` variables; use a different value for each deployment.

## Common commands

```bash
npm test            # Offline automated tests
npm run test:cfbd   # CFBD contracts and data integrity
npm run test:ratings # Rating backtest and calibration contracts
npm run typecheck   # TypeScript
npm run lint        # TypeScript + ESLint
npm run build       # Production bundles
npm run docs:check  # Local Markdown links
npm run check       # Full local quality gate
```

## Documentation

- [Agent guide](AGENTS.md) — commands, repository rules, structure, and completion criteria.
- [Wiki home](docs/wiki/README.md) — product status, architecture, workflows, operations, and reference material.
- [System definition](docs/wiki/product/system-definition.md) — approved scope, domain rules, data authority, and non-goals.
- [Implementation backlog](docs/wiki/product/implementation-backlog.md) — ordered phases, work packages, and exit criteria.
- [Local development](docs/wiki/guides/local-development.md) — setup and everyday workflows.
- [Deployment](docs/wiki/guides/deployment.md) — Convex and Vercel configuration.
- [Product vision](docs/wiki/product/vision.md) — concise end goal and delivery status.

Backend contributors should also read [convex/README.md](convex/README.md). Repository-specific agent workflows live under [.agents/skills](.agents/skills).
