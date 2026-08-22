# Convex backend

This directory is the checked-in server-side boundary for `cfb26`.

> **Deployment blocker:** the football schema and public read functions are now represented here, but the hosted development deployment also contains unrecovered internal legacy-import functions and the checked-in contract has not been push-validated. Do not run Convex push/deploy commands against the recorded environments until parity is reviewed and a development push is explicitly authorized. See [Deployment](../docs/wiki/guides/deployment.md).

## Current contract

| Source       | Export          | Purpose                                                            |
| ------------ | --------------- | ------------------------------------------------------------------ |
| `schema.ts`  | eight tables    | Declares the hosted player lifecycle, roster, program, and NFL model. |
| `players.ts` | `search`        | Searches player display names with optional home-state filtering.  |
| `players.ts` | `getProfile`    | Returns one player with recruiting, stints, career, movements, and draft outcome. |
| `rosters.ts` | `list`          | Returns a bounded program roster, optionally by status and position. |
| `rosters.ts` | `listMovements` | Returns a bounded season movement list, optionally by event kind.  |

All four public functions are unauthenticated reads. Internal legacy-import functions present in development are intentionally not reconstructed here.

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
