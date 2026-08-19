---
name: convex-work
description: "Implement, connect, debug, or review the cfb26 Convex backend: schema, tables, indexes, validators, queries, mutations, actions, generated API usage, real-time data, deployment attachment, or VITE_CONVEX_URL setup. Trigger on Convex, backend, database, data model, schema, query, mutation, action, table, index, deployment, or environment requests; skip styling-only frontend work."
metadata:
  short-description: "Convex schema, functions, data, and setup"
  keywords: "Convex, backend, database, schema, table, index, query, mutation, action, realtime, deployment, VITE_CONVEX_URL"
---

# Convex Work

Change the server boundary and its typed client contract without bypassing Convex's generated API or deployment model.

## Read first

1. Read [AGENTS.md](../../../AGENTS.md).
2. Read [Backend architecture](../../../docs/wiki/architecture/backend.md).
3. For environment or release work, read [Deployment](../../../docs/wiki/guides/deployment.md).

## Model and function rules

- Define tables and indexes in `convex/schema.ts`; keep function modules directly under `convex/` and group them by domain as the app grows.
- Import `query`, `mutation`, `action`, and internal variants from `./_generated/server`. Import `api` and `internal` from `./_generated/api`.
- Never edit `convex/_generated/`. Run the Convex CLI to regenerate it.
- Validate every public argument and return only fields the client should receive.
- Use queries for reads, mutations for transactional writes, and actions only for external services or non-transactional orchestration.
- Bound data access. For growing tables, use indexes and `take`/pagination; do not add an unbounded `collect()` or scan-shaped `.filter()`.
- Keep privileged helpers internal. Authentication is not configured today, so do not mistake the optional viewer identity in the sample query for authorization.

## Client and environment integration

- Call functions through generated references such as `api.myFunctions.listNumbers`; never call raw imported handlers.
- Keep `VITE_CONVEX_URL` limited to the public deployment URL. Put secrets in the Convex deployment environment or hosting environment without the `VITE_` prefix.
- Attaching, creating, or deploying a Convex project changes external state. Do it only when requested and use the deployment the user identifies.

## Verification

Run `npm run typecheck` after contract changes. If a deployment is linked, run `npx convex dev --once` to regenerate types and verify the push, then run `npm run check`. If no deployment is available, report that backend push verification remains pending. Update the backend and configuration wiki pages whenever schema, functions, auth, or deployment behavior changes.
