# Backend architecture

[Architecture index](README.md) · [Wiki home](../README.md)

## Boundary

Convex is the application's database, server-function runtime, real-time transport, and generated client contract. Authored backend files live directly under `convex/`; generated files live under `convex/_generated/`.

## Current data model

`convex/schema.ts` defines one sample table:

| Table     | Field   | Type     | Indexes                      | Purpose                             |
| --------- | ------- | -------- | ---------------------------- | ----------------------------------- |
| `numbers` | `value` | `number` | Built-in creation order only | Proves query/write synchronization. |

The table has no user ownership, domain relationship, retention policy, or product meaning.

## Current functions

| Function                  | Kind     | Arguments           | Result/effect                                                                                                |
| ------------------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `myFunctions.listNumbers` | Query    | `{ count: number }` | Reads at most `count` newest rows, returns them oldest-to-newest as `numbers`, plus `viewer` name or `null`. |
| `myFunctions.addNumber`   | Mutation | `{ value: number }` | Inserts one row and logs its ID; returns no explicit value.                                                  |
| `myFunctions.myAction`    | Action   | `{ first: number }` | Reads ten recent values, logs the result, then calls `addNumber`; returns no explicit value.                 |

All three functions are public. They validate argument types, but they do not authenticate or authorize callers. `ctx.auth.getUserIdentity()` may return an identity only if a provider is configured; no provider is configured in this repository.

## Generated contract

Convex code generation produces:

- `api.d.ts` / `api.js` — references consumed by frontend and backend orchestration.
- `dataModel.d.ts` — types derived from `schema.ts`.
- `server.d.ts` / `server.js` — typed function builders and server utilities.
- `_generated/ai/` — Convex-generated agent guidance/state.

Never patch these outputs. Change schema/functions and run the Convex CLI.

## Design rules for real features

- Split `myFunctions.ts` into domain-named modules once a real domain exists.
- Validate every public argument; validate return values where a boundary benefits from explicit stability.
- Use an index for equality/range access on growing data and pair it with `take` or pagination.
- Avoid unbounded `.collect()` and post-query `.filter()` over tables that can grow.
- Use mutations for atomic database changes. Use actions only for external APIs, Node-specific work, or orchestration that cannot be transactional.
- Make server-only helpers internal and expose the smallest client contract.
- Establish authentication and ownership rules before storing private or per-user data.

## Development loop

1. Attach the intended deployment through the Convex CLI.
2. Edit `schema.ts` and function modules.
3. Run `npx convex dev --once` to push and regenerate.
4. Update frontend calls to generated references.
5. Run `npm run check`.
6. Update this page and [Current contracts](../reference/current-contracts.md) if the contract changed.

If only a deployment URL is available, the browser can connect using `VITE_CONVEX_URL`, but changing/pushing backend functions still requires Convex CLI authentication and deployment selection.
