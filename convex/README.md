# Convex backend

This directory is the checked-in server-side boundary for `cfb26`.

Development was advanced beyond production on 2026-08-23 for the national team-data foundation. Production remains on the earlier Michigan-only contract until an explicit promotion. Confirm the intended target before synchronization. See [Deployment](../docs/wiki/guides/deployment.md).

## Current contract

| Source             | Export          | Purpose                                                                                 |
| ------------------ | --------------- | --------------------------------------------------------------------------------------- |
| `schema.ts`        | 17 tables       | Declares Michigan player data plus national program, recruiting, standings, draft, game, rating, alias, and sync-state records. |
| `crons.ts`         | two daily jobs  | Runs OpenSheet at 10:17 UTC and the credential-gated current-season game refresh at 11:17 UTC. |
| `eligibility.ts`   | shared helper   | Normalizes legacy stint data to five standard seasons plus medical extensions.          |
| `players.ts`       | `search`        | Searches player display names with optional home-state filtering.                       |
| `players.ts`       | `getProfile`    | Returns one player with recruiting, stints, career, seasonal stats, movement, and draft. |
| `rosters.ts`       | `list`          | Returns a bounded program roster, optionally by status and position.                    |
| `rosters.ts`       | `listMovements` | Returns a bounded season movement list, optionally by event kind.                       |
| `seasonalStats.ts` | `listBySeason`  | Returns one season's participants plus rostered players with no source participation.   |
| `teamData.ts`      | six public reads | Lists national rankings/history and reports source synchronization state.               |
| `teamData.ts`      | internal sync   | Fetches, validates, and idempotently upserts the three OpenSheet feeds in bounded batches. |
| `games.ts`         | four public reads | Lists bounded season/week schedules, program schedules, matchup history, and one game's retained team stats. |
| `games.ts`         | internal sync   | Backfills compact CFBD schedules/results and maintains a rolling five-season team-stat window. |
| `ratings.ts`       | two public reads | Lists season Elo rankings and scores a weekly dashboard through national and Michigan lenses. |
| `ratings.ts`       | internal sync   | Fetches and idempotently upserts credential-gated CFBD Elo snapshots beside the game sync. |

The five Michigan reads remain available in both environments. The national team, game, and rating reads and `CFBD_API_KEY` exist in development only until production promotion. Development's initial 2000–2026 backfill is complete. All public identifiers are unauthenticated reads; synchronization is internal and cron-driven.

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
