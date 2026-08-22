# Backend architecture

[Architecture index](README.md) · [Wiki home](../README.md)

## Boundary

Convex is the application's database, server-function runtime, real-time transport, and generated client contract. Authored backend files live directly under `convex/`; generated files live under `convex/_generated/`.

## Checked-in data model

`convex/schema.ts` now declares the same eight football tables and 19 custom indexes (18 database indexes plus one search index) recorded in the hosted deployments. The model covers canonical players, original recruiting profiles, Michigan roster stints, cumulative Michigan career summaries, arrival/departure events, NFL entry outcomes, represented programs, and retained legacy migration rows.

The detailed table grains, field meanings, coverage, and caveats live in [Michigan player data interpretation](../reference/michigan-player-data-report.md). The schema has no user ownership fields because the current product is read-only and unauthenticated.

## Hosted deployment data model

**Current external state (verified 2026-08-22):** the `dreamsbydutch:michigan` development and production deployments share the following declared schema and data. Production was seeded from a development snapshot, preserving document IDs and creation times. The same seven-document Beasley removal and five Underwood/Wafle field corrections were later applied to both deployments.

| Table                    | Documents | Declared indexes                                                                                                      |
| ------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `draftOutcomes`          | 109       | `by_legacyKey`, `by_playerId`, `by_year_and_status`                                                                   |
| `legacyPlayerRows`       | 428       | `by_migrationState`                                                                                                   |
| `movementEvents`         | 720       | `by_playerId_and_season`, `by_programId_and_season_and_kind`, `by_sourceKey`                                          |
| `players`                | 428       | `by_legacyKey`, `by_slug`, search index `search_displayName` filtered by `homeState`                                  |
| `programCareerSummaries` | 428       | `by_legacyKey`, `by_playerId_and_programId`                                                                           |
| `programs`               | 115       | `by_key`                                                                                                              |
| `recruitingProfiles`     | 428       | `by_playerId`, `by_recruitingSeason_and_source`                                                                       |
| `rosterStints`           | 428       | `by_legacyKey`, `by_playerId_and_startSeason`, `by_programId_and_startSeason`, `by_programId_and_status_and_position` |

The development deployment also exposes football query and legacy-import functions. The production migration copied only schema, indexes, and data, so production has no deployed application functions yet. See the [production seed record](../operations/convex-production-seed-2026-08-18.md).

This hosted model is represented by the current `convex/schema.ts`. Do not push this repository to either deployment yet: source parity has not been reviewed through a development push and the internal legacy-import function source remains unrecovered.

## Current functions

| Function                | Kind  | Arguments                                     | Result                                                                                  |
| ----------------------- | ----- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `players.search`        | Query | `{ searchText, homeState?, limit? }`          | Bounded display-name search with optional home-state filter.                            |
| `players.getProfile`    | Query | `{ playerId }`                                | Player plus recruiting profile, stints, career summaries, movements, and draft outcome. |
| `rosters.list`          | Query | `{ programKey?, status?, position?, limit? }` | Bounded roster entries joined to canonical player identity.                             |
| `rosters.listMovements` | Query | `{ programKey?, season, kind?, limit? }`      | Bounded movement events joined to player identity.                                      |

All four checked-in functions are public, read-only, and argument-validated. They do not authenticate or authorize callers. The development deployment exposes equivalent public identifiers plus internal legacy-import functions; production still has no deployed functions.

## Generated contract

Convex code generation produces:

- `api.d.ts` / `api.js` — references consumed by frontend and backend orchestration.
- `dataModel.d.ts` — types derived from `schema.ts`.
- `server.d.ts` / `server.js` — typed function builders and server utilities.
- `_generated/ai/` — Convex-generated agent guidance/state.

Never patch these outputs. Change schema/functions and run the Convex CLI.

## Design rules for real features

- Validate every public argument; validate return values where a boundary benefits from explicit stability.
- Use an index for equality/range access on growing data and pair it with `take` or pagination.
- Avoid unbounded `.collect()` and post-query `.filter()` over tables that can grow.
- Use mutations for atomic database changes. Use actions only for external APIs, Node-specific work, or orchestration that cannot be transactional.
- Make server-only helpers internal and expose the smallest client contract.
- Establish authentication and ownership rules before storing private or per-user data.

## Development loop

Use this loop only after the hosted source-alignment blocker above is resolved.

1. Attach the intended deployment through the Convex CLI.
2. Edit `schema.ts` and function modules.
3. Run `npx convex dev --once` to push and regenerate.
4. Update frontend calls to generated references.
5. Run `npm run check`.
6. Update this page and [Current contracts](../reference/current-contracts.md) if the contract changed.

If only a deployment URL is available, the browser can connect using `VITE_CONVEX_URL`, but changing/pushing backend functions still requires Convex CLI authentication and deployment selection.
