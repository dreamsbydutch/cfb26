# Backend architecture

[Architecture index](README.md) · [Wiki home](../README.md)

## Boundary

Convex is the application's database, server-function runtime, real-time transport, and generated client contract. Authored backend files live directly under `convex/`; generated files live under `convex/_generated/`.

## Checked-in data model

`convex/schema.ts` declares 17 football tables and 47 custom indexes (46 database indexes plus one search index). The model covers canonical players, original recruiting profiles, Michigan roster stints, cumulative Michigan career summaries, season-level snap counts and PFF grades, arrival/departure events, player-linked NFL entry outcomes, represented programs, retained legacy migration rows, source-specific program aliases, national team recruiting classes, team standings/statistics, national draft selections, compact college games, rolling team-game statistics, season Elo ratings, and synchronization state.

The Michigan table details live in [Michigan player data interpretation](../reference/michigan-player-data-report.md); the national tables live in [Team-level historical data](../reference/team-level-data.md). Roster-stint reads pass through a shared eligibility normalizer: everyone receives a five-season baseline, `medicalExtensionSeasons` adds only granted time beyond it, and the legacy redshirt field is not returned publicly. The schema temporarily accepts both extension fields so the hosted rows can transition without downtime. The schema has no user ownership fields because the current product is read-only and unauthenticated.

## Hosted deployment data model

**Production external state (verified 2026-08-22):** production retains the following Michigan-only schema and data. Production was seeded from a development snapshot, preserving document IDs and creation times. The same seven-document Beasley removal, five Underwood/Wafle field corrections, and 921-row seasonal-stat import were applied to both deployments at that time.

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
| `seasonalPlayerStats`    | 921       | `by_playerId_and_season`, `by_programId_and_season_and_snaps`, `by_sourceKey`                                         |

Production exposes the five Michigan football queries. See the [production seed record](../operations/convex-production-seed-2026-08-18.md).

**Development external state (verified 2026-08-23):** development contains 47,774 documents across 17 tables. The national expansion has 492 programs, 1,388 source aliases, 5,025 recruiting rows, 3,122 standings rows, 1,024 draft selections, 22,169 compact 2000–2026 games, 3,340 season Elo ratings, 7,318 detailed 2022–2025 team-game rows, and six sync-state rows. Daily jobs refresh the three OpenSheet feeds at 10:17 UTC and the current game season/ratings at 11:17 UTC; the game-stat refresh revisits the latest two completed weeks.

## Current functions

| Function                     | Kind  | Arguments                                     | Result                                                                                                                                |
| ---------------------------- | ----- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `players.search`             | Query | `{ searchText, homeState?, limit? }`          | Bounded display-name search with optional home-state filter.                                                                          |
| `players.getProfile`         | Query | `{ playerId }`                                | Player plus recruiting, normalized stints, career summaries, seasonal stats, movements, and draft outcome.                            |
| `rosters.list`               | Query | `{ programKey?, status?, position?, limit? }` | Bounded roster entries joined to canonical player identity, with normalized eligibility.                                              |
| `rosters.listMovements`      | Query | `{ programKey?, season, kind?, limit? }`      | Bounded movement events joined to player identity.                                                                                    |
| `seasonalStats.listBySeason` | Query | `{ programKey?, season }`                     | Bounded season stats merged with canonical roster players who have no participation record for the year, with normalized eligibility. |

All five functions are public, read-only, argument-validated, and deployed in both environments. Development additionally exposes the six team-data reads, four game-data reads, and two landscape-rating reads documented under [Current contracts](../reference/current-contracts.md). Public reads do not authenticate or authorize callers. The feed synchronization path is internal.

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

1. Attach the intended deployment through the Convex CLI.
2. Edit `schema.ts` and function modules.
3. Run `npx convex dev --once` to push and regenerate.
4. Update frontend calls to generated references.
5. Run `npm run check`.
6. Update this page and [Current contracts](../reference/current-contracts.md) if the contract changed.

If only a deployment URL is available, the browser can connect using `VITE_CONVEX_URL`, but changing/pushing backend functions still requires Convex CLI authentication and deployment selection.
