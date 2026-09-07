# Convex backend

This directory is the checked-in server boundary for `cfb26`. Source defines 43 tables and 104 indexes spanning the Michigan lifecycle, national team/game data, immutable rating outputs, owner operations/audit, and Michigan-alumni NFL history. Development `adjoining-opossum-710` and production `doting-chipmunk-7` still run the earlier 41-table contract from the backed-up 2026-09-07 cutover; confirm the exact target before synchronizing this delta.

## Module map

| Module | Responsibility |
| --- | --- |
| `schema.ts` | Validated tables, null semantics, indexes, immutable outputs, source state, sessions, revisioned backups, and owner audit logs. |
| `playerDomain.ts`, `eligibility.ts` | Position rooms, grade rules/summaries, and season-specific eligibility derivation. |
| `players.ts`, `rosters.ts` | Public profile, comparison, alumni, season-roster, scholarship, eligibility, development, and movement reads. |
| `rosterAdmin.ts` | Owner sessions and transactional lifecycle, season, evaluation, NFL-gap, import, rollover, merge, delete, backup, rules, and identity workflows. |
| `seasonalStats.ts` | Michigan Player Game validation, import, phase grades, conventional statistics, and summaries. |
| `cfbdClient.ts`, `games.ts`, `teamData.ts` | Direct CFBD contracts, compact games, programs, aliases, affiliations, venues, enrichment, drafts, polls, caching, and source health. |
| `nflverse.ts`, `teamData.ts` | Direct nflverse parsing and confirmed-identity alumni roster/game synchronization. |
| `ratingSystem.ts`, `ratingBacktest.ts`, `ratings.ts` | Power and Résumé editions, model gates, uncertainty, frozen forecasts, matchup scenarios, schedule/quadrant evidence, playoff fields, and ballots. |
| `migrationV2.ts` | Pure legacy audit and migration planning with explicit PFF deletion and unresolved identities. |
| `migrations.ts` | Stateful online migration that audits and retires server manifests created before Michigan data revisions. |
| `crons.ts` | Direct-source refreshes, rolling-detail pruning, nightly editions, Monday official editions, and forecast freezing. |

The source authority is CFBD for national college facts, nflverse for alumni NFL performance, the owner for Michigan-specific facts and corrections, and CFB26 for derived outputs. Failed syncs retain the last valid data. Core failures block official publication; optional enrichment failures remain visible.

## Rules

- Author functions under `convex/`; never hand-edit `_generated/`.
- Validate every public argument and bound growing reads with indexes plus `take` or pagination.
- Use queries for reads, mutations for transactional writes, and actions only for external/non-transactional work.
- Keep `CFBD_API_KEY` and `CFB26_ADMIN_KEY` in the selected Convex environment, never in source or `VITE_*` values.
- Treat official editions, frozen forecasts, submitted ballots, and retained history as immutable.
- Advance Michigan data revision and append an audit event with every consequential owner write.
- Require a backup manifest matching the current revision before material Michigan operations.

Run `npm run check` locally. A backend promotion also requires an explicitly authorized `npx convex dev --once` against the confirmed development target before production. See [Backend architecture](../docs/wiki/architecture/backend.md) and [Deployment](../docs/wiki/guides/deployment.md).
