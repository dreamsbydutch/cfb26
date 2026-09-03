# cfb26

`cfb26` is a Michigan football personnel and national landscape explorer built with TanStack Start and Convex. It presents the current depth chart, recruiting and draft classes, 2015–2025 snap counts and PFF grades, points-scale CFB26 Power Ratings, Week 7 Résumé Ratings, weekly game importance, and custom head-to-head matchups.

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
- [Local development](docs/wiki/guides/local-development.md) — setup and everyday workflows.
- [Deployment](docs/wiki/guides/deployment.md) — Convex and Vercel configuration.
- [Product vision](docs/wiki/product/vision.md) — current end goal, boundaries, and open decisions.

Backend contributors should also read [convex/README.md](convex/README.md). Repository-specific agent workflows live under [.agents/skills](.agents/skills).
