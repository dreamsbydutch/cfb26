# Convex backend

This directory is the checked-in server-side boundary for `cfb26`.

Development has the checked-in 19-table national-data and proprietary-rating contract. Production remains on the prior 17-table foundation until explicitly promoted. Confirm the intended target before synchronization. See [Deployment](../docs/wiki/guides/deployment.md).

## Current contract

| Source             | Export          | Purpose                                                                                 |
| ------------------ | --------------- | --------------------------------------------------------------------------------------- |
| `schema.ts`        | 19 tables       | Declares Michigan player data, national facts, raw rating inputs, derived composite ratings, aliases, and sync state. |
| `crons.ts`         | three daily jobs | Runs OpenSheet at 10:17 UTC, games/Elo at 11:17 UTC, and the advanced-input/composite refresh at 11:47 UTC. |
| `eligibility.ts`   | shared helper   | Normalizes legacy stint data to five standard seasons plus source and owner extensions. |
| `players.ts`       | `search`        | Searches player display names with optional home-state filtering.                       |
| `players.ts`       | `getProfile`    | Returns one player with recruiting, stints, career, seasonal stats, movement, and draft. |
| `rosters.ts`       | `list`          | Returns a bounded program roster, optionally by status and position.                    |
| `rosters.ts`       | `listMovements` | Returns a bounded season movement list, optionally by event kind.                       |
| `rosterAdmin.ts`   | `updatePlayer`  | Atomically edits one roster stint after deployment-key verification.                    |
| `seasonalStats.ts` | `listBySeason`  | Returns one season's participants plus rostered players with no source participation.   |
| `teamData.ts`      | six public reads | Lists national rankings/history and reports source synchronization state.               |
| `teamData.ts`      | internal sync   | Fetches, validates, and idempotently upserts the three OpenSheet feeds in bounded batches. |
| `games.ts`         | four public reads | Lists bounded season/week schedules, program schedules, matchup history, and one game's retained team stats. |
| `games.ts`         | internal sync   | Backfills compact CFBD schedules/results and maintains a rolling five-season team-stat window. |
| `ratingInputs.ts`  | internal sync   | Independently refreshes six credential-gated CFBD rating, advanced-stat, talent, and continuity sources. |
| `ratingModel.ts`   | pure model      | Normalizes season evidence into 16 perspectives, confidence, overall rank, and matchup projections. |
| `ratings.ts`       | four public reads | Keeps legacy Elo, lists composite ratings, scores the weekly dashboard, and builds head-to-head matchups. |
| `ratings.ts`       | internal orchestration | Fetches Elo and rebuilds versioned composite snapshots in bounded batches. |

The five Michigan reads and the shared national team/game/Elo reads are available in both environments. The composite reads and roster mutation are development-only until production promotion. Each environment has its own `CFBD_API_KEY`; roster writes additionally require a distinct `CFB26_ADMIN_KEY`. Both initial 2000–2026 game backfills are complete. Public reads remain unauthenticated; synchronization and model rebuilds are internal and cron-driven.

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
npm run typecheck
```

The Convex commands require a linked deployment. See [Backend architecture](../docs/wiki/architecture/backend.md) and [Deployment](../docs/wiki/guides/deployment.md) for the complete workflow.
