# Convex backend

This directory is the checked-in server-side boundary for `cfb26`.

Deployment parity was last verified on 2026-08-22. Changes made after that date require the normal development-first synchronization before production promotion. Confirm the intended target before synchronization. See [Deployment](../docs/wiki/guides/deployment.md).

## Current contract

| Source             | Export          | Purpose                                                                                 |
| ------------------ | --------------- | --------------------------------------------------------------------------------------- |
| `schema.ts`        | nine tables     | Declares the lifecycle model plus per-season Michigan snap counts and PFF grades.       |
| `eligibility.ts`   | shared helper   | Normalizes legacy stint data to five standard seasons plus medical extensions.          |
| `players.ts`       | `search`        | Searches player display names with optional home-state filtering.                       |
| `players.ts`       | `getProfile`    | Returns one player with recruiting, stints, career, seasonal stats, movement, and draft. |
| `rosters.ts`       | `list`          | Returns a bounded program roster, optionally by status and position.                    |
| `rosters.ts`       | `listMovements` | Returns a bounded season movement list, optionally by event kind.                       |
| `seasonalStats.ts` | `listBySeason`  | Returns one season's participants plus rostered players with no source participation.   |

All five public function identifiers are unauthenticated reads in development and production. The obsolete internal legacy-import functions were deliberately retired during source alignment.

Public roster-stint results omit the stored legacy redshirt field. They expose `medicalExtensionSeasons` and derive `eligibilityEndSeason` from a five-season baseline. The schema keeps the old field optional only so existing hosted rows remain valid during the data transition.

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
