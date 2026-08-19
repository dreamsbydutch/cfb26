# Convex backend

This directory is the complete server-side boundary for `cfb26`.

## Current contract

| Source | Export | Purpose |
| --- | --- | --- |
| `schema.ts` | `numbers` | Sample table containing one numeric `value`. |
| `myFunctions.ts` | `listNumbers` | Returns the newest bounded set of values plus the optional viewer name. |
| `myFunctions.ts` | `addNumber` | Inserts one validated number. |
| `myFunctions.ts` | `myAction` | Sample action that reads recent values and invokes `addNumber`. |

These functions demonstrate the connection; they are not yet a product data model.

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
