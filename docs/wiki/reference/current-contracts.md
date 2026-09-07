# Current contracts

[Reference index](README.md) · [Wiki home](../README.md)

This page inventories the current source interfaces. Development `adjoining-opossum-710` and production `doting-chipmunk-7` still hold the 41-table backend synchronized during the 2026-09-07 backed-up cutover; the 43-table revision/audit delta and final-form web UI remain separate, undeployed release boundaries.

## Web routes

| Route family                       | Contract                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/michigan/*`                 | Matrix-first Michigan context with football-ordered rooms and usage lanes. Canonical routes expose Overview/readiness, Movement, Alumni, player intelligence, and four-player comparison. Season/preset/comparison state is URL-visible or persistent as appropriate. `/michigan/matrix` redirects to `/`. |
| `/games`, `/national/*`            | Games, continuous complete-field Power, Résumé, deterministic Playoff, Teams/program profiles, Simulator, Blind Ballot, and Methodology. Schedule ranks come from the selected edition; Power rows expose components, basis, sample, sources, and coverage. `/national/games` redirects to `/games`.       |
| `/admin/roster`, `/admin/roster/*` | No-index desktop Owner Dashboard, Roster/player editor, Season/grid and Player Games, Data/import/identity, and isolated Operations routes. A password creates a revocable 12-hour session; all access validates server-side, and narrow layouts expose status/sign-out without mutation controls.         |

All routes include responsive navigation, semantic controls, visible focus treatment, and explicit loading/error/empty states. Michigan and Owner retain the navy-and-maize presentation; National uses a charcoal grayscale system and reserves the Michigan colors for Michigan programs and matchups inside national lists.

## Public Convex reads

| Family               | Principal exports                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Players              | `players.search`, bounded `players.searchCatalog`, `players.getProfile`, `players.compare`, `players.listNflAlumni`                                                                                      |
| Michigan rosters     | `rosters.getSeasonDashboard`, `rosters.list`, `rosters.listMovements`                                                                                                                                    |
| Michigan games       | `seasonalStats.listBySeason`, `seasonalStats.listGame`                                                                                                                                                   |
| National games/teams | `games.listSeasonWeek`, `games.listProgramGames`, `games.listMatchup`, `games.getGame`; `teamData.listPrograms`, `teamData.getProgramProfile`, season recruiting/standings/draft/history and sync health |
| Ratings/ranking      | `ratings.getWeeklyDashboard`, `ratings.getMatchup`, `ratings.getMeritDashboard`, `ratings.getBallot`                                                                                                     |

Every growing read is bounded through `take` or pagination. Public reads require no owner session.

`ratings.publicationReadiness` is an internal publication gate rather than a public read.

## Owner functions

`rosterAdmin.login` exchanges `CFB26_ADMIN_KEY` for a random token whose SHA-256 hash and expiry are stored server-side. `sessionStatus` and `logout` validate/revoke it. The secret must be at least 24 characters and never enters `VITE_*` configuration.

The owner contract includes:

- create Person, enroll/decommit prospect, start/close stints, and overwrite Player Seasons;
- add repeatable evaluations, draft outcomes, nflverse identities, and weekly NFL gap records;
- dry-run/apply roster and Player Game imports, with blocking-error abort, explicit preview acknowledgement, and a current-revision backup before apply;
- preview/apply season rollover;
- export paginated Michigan datasets and create a version-3 fingerprint/manifest bound to the Michigan data revision;
- preview affected records, then merge duplicate people or delete an erroneous person transactionally;
- set season rules and actual conference champions;
- resolve provider identities without heuristic matching; and
- stage and review multi-player Season edits before one validated transaction;
- view source, identity, operation, revision, audit, backup, eligibility, and publication health.

Every consequential Michigan owner mutation advances `michiganDataRevisions` and inserts an `ownerAuditEvents` record with actor/session, action, target, timestamps, result, warnings, and backup reference where applicable. Import, rollover, merge, and delete reject a manifest whose revision no longer matches. `migrations.retireUnversionedBackupManifests` audits and deletes only old server-side manifests; downloaded files remain unchanged.

`seasonalStats.upsertPlayerGame` enforces the zero/null/grade invariant and Michigan roster/game identity. A person/game pair is unique.

## Rating and ranking contract

- Power is a neutral-field points scale with explicit prior weight, version, calibration, units, home field, and sample state.
- Power ranks the complete season-specific FBS schedule field from `1` through the field size; it has no fixed top-25 or top-50 publication cutoff, so historical and future counts can differ.
- When no weekly edition or season composite exists, the complete-field fallback uses current-season Elo where present, then the prior-season composite, then prior-season Elo, and finally a visible neutral baseline. It never leaves a scheduled FBS team unranked silently.
- The Power UI exposes offense, defense, special teams, prior weight, sample state, source list, signal count/confidence when available, and the exact edition/composite/fallback basis for every team.
- Résumé appears from Week 7 and uses the approved 90% results/schedule plus 10% capped-dominance split.
- Edition snapshots drive historical quadrants, schedule strength, and playoff/ballot evidence; future data is never substituted.
- Scheduled 2026-forward prospective forecasts freeze before kickoff. Research reconstructions are labeled and kept separate.
- Playoff fields use stored season rules and actual champions when present, otherwise provisional highest-ranked eligible conference teams.
- Ballot moves use insertion ordering. A submitted ballot locks and reveals team identity; drafts can be restarted rather than revised.

## Data-source and retention contract

Direct CFBD requests supply national programs, games, features, recruiting/talent/returning context, draft selections, and polls. Direct nflverse release files supply confirmed Michigan alumni only. Source failures retain good data and report staleness. Detailed national team-game features are pruned outside the rolling five-year window; compact games and frozen outputs remain.

## Operational commands

- `npm run migration:plan -- <legacy-export.json>` creates a no-write audit.
- `npm run migration:prepare -- <legacy-export.json> <new-directory> [season]` creates non-overwriting target JSONL plus an audit report.
- `npm run restore:prepare -- <backup.json> <new-directory>` verifies a version-2 or revision-bound version-3 backup fingerprint and prepares ordered JSONL without writing Convex.
- `npm run check` runs offline tests, type/lint, documentation links, and the production build.

The exact hosted cutover sequence lives in [Deployment](../guides/deployment.md).
