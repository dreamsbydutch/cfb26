# Convex backend

This directory is the checked-in server-side boundary for `cfb26`.

The checked-in contract was push-validated in development and deployed to production on 2026-08-22. Confirm the intended target before any later synchronization. See [Deployment](../docs/wiki/guides/deployment.md).

## Current contract

| Source             | Export          | Purpose                                                                                 |
| ------------------ | --------------- | --------------------------------------------------------------------------------------- |
| `schema.ts`        | nine tables     | Declares the lifecycle model plus per-season Michigan snap counts and PFF grades.       |
| `players.ts`       | `search`        | Searches player display names with optional home-state filtering.                       |
| `players.ts`       | `getProfile`    | Returns one player with recruiting, stints, career, seasonal stats, movement, and draft. |
| `rosters.ts`       | `list`          | Returns a bounded program roster, optionally by status and position.                    |
| `rosters.ts`       | `listMovements` | Returns a bounded season movement list, optionally by event kind.                       |
| `seasonalStats.ts` | `listBySeason`  | Returns one season's participants plus rostered players with no source participation.   |

All five public functions are unauthenticated reads and are deployed in development and production. The obsolete internal legacy-import functions were deliberately retired during source alignment.

## Rules

- Author schema and functions directly under `convex/`.
- Import function builders from `./_generated/server` and API references from `./_generated/api`.
- Never hand-edit `_generated/`; regenerate it through the Convex CLI.
- Validate every public argument and keep reads bounded. Add indexes before adding filter-shaped access patterns to growing tables.
- Use queries for reads, mutations for transactional writes, and actions only when external or non-transactional work requires them.
- Keep secrets in the Convex deployment environment, never in `VITE_*` variables or tracked files.

## Work locally

```bash
npm run dev
npx convex dev --once
npm run typecheck
```

The Convex commands require a linked deployment. See [Backend architecture](../docs/wiki/architecture/backend.md) and [Deployment](../docs/wiki/guides/deployment.md) for the complete workflow.
