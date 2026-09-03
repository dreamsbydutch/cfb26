# Convex backend

This directory is the checked-in server-side boundary for `cfb26`.

Checked-in source defines the 21-table national-data and immutable Power/Résumé edition contract. It has not been pushed: development still hosts the prior 19-table percentile-composite contract and production remains on the earlier 17-table foundation. Confirm the intended target before synchronization. See [Deployment](../docs/wiki/guides/deployment.md).

## Current contract

| Source             | Export          | Purpose                                                                                 |
| ------------------ | --------------- | --------------------------------------------------------------------------------------- |
| `schema.ts`        | 21 tables       | Declares Michigan player data, national facts, legacy composites, immutable rating editions/team snapshots, aliases, and sync state. |
| `crons.ts`         | four jobs | Runs OpenSheet and game refreshes daily, builds changed Power/Résumé data nightly, and freezes an official edition each Monday. |
| `eligibility.ts`   | shared helper   | Normalizes legacy stint data to five standard seasons plus source and owner extensions. |
| `players.ts`       | `search`        | Searches player display names with optional home-state filtering.                       |
| `players.ts`       | `getProfile`    | Returns one player with recruiting, stints, career, seasonal stats, movement, and draft. |
| `rosters.ts`       | `list`          | Returns a bounded program roster, optionally by status and position.                    |
| `rosters.ts`       | `listMovements` | Returns a bounded season movement list, optionally by event kind.                       |
| `rosterAdmin.ts`   | `updatePlayer`  | Atomically edits one roster stint after deployment-key verification.                    |
| `rosterAdmin.ts`   | `addPlayer`     | Atomically creates an active player's identity, recruiting profile, stint, zeroed career summary, and arrival event. |
| `rosterAdmin.ts`   | `removePlayer`  | Atomically closes an active stint and records a transfer, graduation, retirement, or dismissal. |
| `seasonalStats.ts` | `listBySeason`  | Returns one season's participants plus rostered players with no source participation.   |
| `teamData.ts`      | six public reads | Lists national rankings/history and reports source synchronization state.               |
| `teamData.ts`      | internal sync   | Fetches, validates, and idempotently upserts the three OpenSheet feeds in bounded batches. |
| `games.ts`         | four public reads | Lists bounded season/week schedules, program schedules, matchup history, and one game's retained team stats. |
| `games.ts`         | internal sync   | Backfills compact CFBD schedules/results and maintains a rolling five-season team-stat window. |
| `cfbdClient.ts`    | shared adapter  | Authenticates CFBD requests, validates endpoint contracts, and classifies safe retry behavior. |
| `cfbdAudit.ts`     | pure audit      | Reconciles games, box scores, and FBS membership for one as-of-week dataset. |
| `cfbdHealth.ts`    | internal action | Runs the read-only multi-endpoint CFBD canary without writing football data. |
| `ratingInputs.ts`  | internal sync   | Independently refreshes six credential-gated CFBD rating, advanced-stat, talent, and continuity sources. |
| `ratingBacktest.ts` | pure evaluation | Builds leakage-safe rolling folds, scores forecasts, fits logistic margin calibration, and gates model promotion. |
| `ratingModel.ts`   | legacy pure model | Preserves `cfb26-composite-v2` only as a migration fallback. |
| `ratingSystem.ts`  | pure model      | Fits hierarchical Power Ratings, builds Week 7 Résumé Ratings, and produces points/probability matchup projections. |
| `ratings.ts`       | public and internal orchestration | Selects immutable editions for dashboard/matchup reads, retains legacy fallbacks, and builds nightly/official/amendment/research editions. |

The five Michigan reads and the shared national team/game/Elo reads are available in both environments. Composite reads and the earlier `updatePlayer` roster mutation are development-only until production promotion; the checked-in `addPlayer` and `removePlayer` functions still need an authorized development push. Each environment has its own `CFBD_API_KEY`; every roster write additionally requires a distinct `CFB26_ADMIN_KEY`. Both initial 2000–2026 game backfills are complete. Public reads remain unauthenticated; synchronization and model rebuilds are internal and cron-driven.

Public roster-stint results omit the stored legacy redshirt field. They expose source medical and owner-added eligibility seasons and derive `eligibilityEndSeason` from the five-season baseline plus both extensions. Stints may also expose a tier override, current injury, and bounded position-change history. The schema keeps the old redshirt field optional only so existing hosted rows remain valid during the data transition.

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
npm run test:cfbd
npm run typecheck
```

The Convex commands require a linked deployment. See [Backend architecture](../docs/wiki/architecture/backend.md) and [Deployment](../docs/wiki/guides/deployment.md) for the complete workflow.
