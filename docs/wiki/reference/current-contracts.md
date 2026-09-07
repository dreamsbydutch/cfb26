# Current contracts

[Reference index](README.md) · [Wiki home](../README.md)

This page inventories source interfaces synchronized to development `adjoining-opossum-710` and production `doting-chipmunk-7` during the 2026-09-07 backed-up cutover. Web deployment remains a separate release boundary.

## Web routes

| Route           | Contract                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | In-review DbyD CFB Michigan front door with three URL-selectable (`variant=A`, `variant=B`, or `variant=C`) live-data roster concepts. All share season/search/room filtering, movement evidence, player quick views, and a persistent comparison tray capped at four people. The former broad roster UI is not rendered during evaluation. |
| `/games`        | Public national workspace with Games, Power, Résumé, Playoff, Teams, Simulator, and Blind Ballot tabs. Schedule evidence is edition-cutoff safe and hardest-first. Ballot identities remain hidden until owner submission.                                                                                                                  |
| `/admin/roster` | No-index private owner workspace. A password creates a revocable 12-hour session; lifecycle, annual season, Player Game, identity, draft/NFL, import, backup, rollover, rules/champions, repair, and health operations validate server-side.                                                                                                |

All routes include responsive navigation, semantic controls, visible focus treatment, and explicit loading/error/empty states.

## Public Convex reads

| Family               | Principal exports                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Players              | `players.search`, `players.getProfile`, `players.compare`, `players.listNflAlumni`                                                                                                                       |
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
- dry-run/apply roster and Player Game imports, with a verified backup before apply;
- preview/apply season rollover;
- export paginated Michigan datasets and create a fingerprinted backup manifest;
- merge duplicate people or delete an erroneous person transactionally;
- set season rules and actual conference champions;
- resolve provider identities without heuristic matching; and
- view source, identity, operation, backup, eligibility, and publication health.

`seasonalStats.upsertPlayerGame` enforces the zero/null/grade invariant and Michigan roster/game identity. A person/game pair is unique.

## Rating and ranking contract

- Power is a neutral-field points scale with explicit prior weight, version, calibration, units, home field, and sample state.
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
- `npm run restore:prepare -- <backup.json> <new-directory>` verifies a v2 backup fingerprint and prepares ordered JSONL without writing Convex.
- `npm run check` runs offline tests, type/lint, documentation links, and the production build.

The exact hosted cutover sequence lives in [Deployment](../guides/deployment.md).
