# cfb26

`cfb26` is a Michigan-first college football intelligence system built with React, TanStack Start, and Convex. The checked-in application covers Michigan player lifecycles, season rosters, game participation and CFB26 Player Grades; national programs, schedules, ratings, résumés, playoff projections, and matchups; an identity-blind all-FBS owner ballot; and Michigan-alumni NFL tracking.

The public app is read-only. `/admin/roster` is a private, single-owner workspace for lifecycle, season, game, identity, import, backup, rollover, and data-health workflows. PFF and OpenSheet are not runtime dependencies.

The new source contract has not been promoted to either recorded Convex deployment. Hosted migration, development synchronization, production promotion, and smoke testing remain explicit target-specific operations; see [Deployment](docs/wiki/guides/deployment.md).

## Quick start

Requirements: Node.js 22.12+ and npm.

```bash
npm install
npm run dev:web
```

The browser needs a compatible `VITE_CONVEX_URL` in an ignored `.env.local`. Use `npm run dev` only when synchronizing against the confirmed development deployment is intended.

## Owner administration

Set a unique high-entropy owner secret in the selected Convex deployment. The browser exchanges it for a revocable 12-hour session; the password is never stored in browser state.

```powershell
npx convex env set CFB26_ADMIN_KEY
```

Never place that value in source, shell arguments, or a `VITE_*` variable. Confirm the exact deployment before any Convex command.

Material import, rollover, merge, or deletion requires an owner-generated Michigan backup manifest. Prepare a downloaded backup for a controlled restore with:

```bash
npm run restore:prepare -- path/to/backup.json path/to/new-restore-directory
```

The command verifies the backup fingerprint and writes ordered JSONL datasets without changing Convex.

## Common commands

```bash
npm test             # Offline automated tests
npm run test:cfbd    # CFBD contracts and integrity
npm run test:ratings # Rating leakage/calibration/model gates
npm run typecheck    # Strict TypeScript
npm run lint         # TypeScript and ESLint
npm run build        # Production bundle
npm run docs:check   # Maintained Markdown links
npm run check        # Full local quality gate
```

## Documentation

- [Agent guide](AGENTS.md) — operating rules and repository structure.
- [Wiki home](docs/wiki/README.md) — current status and durable documentation.
- [System definition](docs/wiki/product/system-definition.md) — scope, invariants, and non-goals.
- [Implementation backlog](docs/wiki/product/implementation-backlog.md) — the nine implemented source phases and hosted cutover boundary.
- [Deployment](docs/wiki/guides/deployment.md) — migration, Convex, Vercel, rollback, and smoke checks.
- [Backend contract](convex/README.md) — tables, modules, source ownership, and server rules.
