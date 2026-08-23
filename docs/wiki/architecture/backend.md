# Backend architecture

[Architecture index](README.md) · [Wiki home](../README.md)

## Boundary

Convex is the application's database, server-function runtime, real-time transport, and generated client contract. Authored backend files live directly under `convex/`; generated files live under `convex/_generated/`.

## Checked-in data model

`convex/schema.ts` declares 19 football tables and 51 custom indexes (50 database indexes plus one search index). The model covers canonical players, original recruiting profiles, Michigan roster stints, cumulative Michigan career summaries, season-level snap counts and PFF grades, arrival/departure events, player-linked NFL entry outcomes, represented programs, retained legacy migration rows, source-specific program aliases, national team recruiting classes, team standings/statistics, national draft selections, compact college games, rolling team-game statistics, season Elo ratings, raw multi-source rating inputs, derived composite ratings, and synchronization state.

The Michigan table details live in [Michigan player data interpretation](../reference/michigan-player-data-report.md); the national tables live in [Team-level historical data](../reference/team-level-data.md). Roster-stint reads pass through a shared eligibility normalizer: everyone receives a five-season baseline, `medicalExtensionSeasons` preserves source-granted time, `extraEligibilitySeasons` stores an owner override, and the legacy redshirt field is not returned publicly. A stint may also carry a depth-tier override, one current public injury state, and up to 20 position changes. The schema has no user ownership fields; the narrow admin write uses a deployment secret rather than accounts.

## Hosted deployment data model

**Current development state (verified 2026-08-23):** `adjoining-opossum-710` has the 19-table contract, one composite row per Elo-covered FBS team for every 2000–2025 season, a 2026 preseason snapshot, and advanced input rows for 2025–2026. Its three daily jobs refresh OpenSheet at 10:17 UTC, games/Elo at 11:17 UTC, and advanced inputs plus the composite at 11:47 UTC.

**Current production state (verified 2026-08-23):** `doting-chipmunk-7` remains on the prior 17-table, 47,774-document foundation until explicitly promoted. The shared foundation has 492 programs, 1,388 source aliases, 5,025 recruiting rows, 3,122 standings rows, 1,024 draft selections, 22,169 compact 2000–2026 games, 3,340 season Elo ratings, and 7,318 detailed 2022–2025 team-game rows. Do not describe the proprietary model as production behavior before that promotion.

The original Michigan tables remain present in both environments:

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

The initial production seed history is preserved in the [production seed record](../operations/convex-production-seed-2026-08-18.md).

## Current functions

| Function                     | Kind     | Arguments                                                          | Result                                                                                                                                |
| ---------------------------- | -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `players.search`             | Query    | `{ searchText, homeState?, limit? }`                               | Bounded display-name search with optional home-state filter.                                                                          |
| `players.getProfile`         | Query    | `{ playerId }`                                                     | Player plus recruiting, normalized stints, career summaries, seasonal stats, movements, and draft outcome.                            |
| `rosters.list`               | Query    | `{ programKey?, status?, position?, limit? }`                      | Bounded roster entries joined to canonical player identity, with normalized eligibility.                                              |
| `rosters.listMovements`      | Query    | `{ programKey?, season, kind?, limit? }`                           | Bounded movement events joined to player identity.                                                                                    |
| `seasonalStats.listBySeason` | Query    | `{ programKey?, season }`                                          | Bounded season stats merged with canonical roster players who have no participation record for the year, with normalized eligibility. |
| `rosterAdmin.updatePlayer`   | Mutation | player, depth, eligibility, injury, position, and admin-key fields | Atomically updates one program stint after server-side single-owner key verification.                                                 |

All five roster/player read functions remain public and argument-validated. The shared foundation also exposes six team-data reads and four game-data reads. Development adds `ratings.listComposite`, `ratings.getMatchup`, and `rosterAdmin.updatePlayer`; its weekly dashboard prefers the proprietary snapshot over Elo. The roster mutation requires a minimum-24-character `CFB26_ADMIN_KEY` stored in that Convex deployment and rejects before reading data when the key is absent or wrong. Feed synchronization and rating rebuilds are internal.

`ratingInputs.ts` fetches CORE, SP+, FPI, advanced season statistics, team talent, and returning production independently. Successful sources replace only their own signal namespace; failed or unavailable sources leave the last good values intact and appear as sync warnings. `ratingModel.ts` is a pure deterministic builder that normalizes the loaded season, computes the 16 perspectives/confidence/overall rank, and constructs matchup projections. `ratings.ts` owns the bounded database orchestration and public read contract.

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
4. For model changes, rebuild the intended development seasons and confirm `modelVersion`/coverage before any production promotion.
5. Update frontend calls to generated references.
6. Run `npm run check`.
7. Update this page and [Current contracts](../reference/current-contracts.md) if the contract changed.

If only a deployment URL is available, the browser can connect using `VITE_CONVEX_URL`, but changing/pushing backend functions still requires Convex CLI authentication and deployment selection.
