# Backend architecture

[Architecture index](README.md) · [Wiki home](../README.md)

## Boundary

Convex is the application's database, server-function runtime, real-time transport, and generated client contract. Authored backend files live directly under `convex/`; generated files live under `convex/_generated/`.

## Checked-in data model

`convex/schema.ts` declares 21 football tables and 57 custom indexes (56 database indexes plus one search index). The model covers canonical players, original recruiting profiles, Michigan roster stints, cumulative Michigan career summaries, season-level snap counts and PFF grades, arrival/departure events, player-linked NFL entry outcomes, represented programs, retained legacy migration rows, source-specific program aliases, national team recruiting classes, team standings/statistics, national draft selections, compact college games, rolling team-game statistics, season Elo ratings, raw multi-source rating inputs, legacy composite ratings, immutable rating editions/team snapshots, and synchronization state. Owner-authored additions use the normalized lifecycle tables directly and intentionally have no synthetic `legacyPlayerRows` audit record.

The Michigan table details live in [Michigan player data interpretation](../reference/michigan-player-data-report.md); the national tables live in [Team-level historical data](../reference/team-level-data.md). Roster-stint reads pass through a shared eligibility normalizer: everyone receives a five-season baseline, `medicalExtensionSeasons` preserves source-granted time, `extraEligibilitySeasons` stores an owner override, and the legacy redshirt field is not returned publicly. A stint may also carry a depth-tier override, one current public injury state, and up to 20 position changes. The schema has no user ownership fields; the narrow admin write uses a deployment secret rather than accounts.

## Hosted deployment data model

**Current development state (last verified 2026-08-23):** `adjoining-opossum-710` has the prior 19-table contract, one composite row per Elo-covered FBS team for every 2000–2025 season, a 2026 preseason snapshot, and advanced input rows for 2025–2026. The checked-in 21-table Power/Résumé contract and its revised jobs still need an authorized development push.

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

| Function                     | Kind     | Arguments                                                                                                         | Result                                                                                                                                 |
| ---------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `players.search`             | Query    | `{ searchText, homeState?, limit? }`                                                                              | Bounded display-name search with optional home-state filter.                                                                           |
| `players.getProfile`         | Query    | `{ playerId }`                                                                                                    | Player plus recruiting, normalized stints, career summaries, seasonal stats, movements, and draft outcome.                             |
| `rosters.list`               | Query    | `{ programKey?, status?, position?, limit? }`                                                                     | Bounded roster entries joined to canonical player identity, with normalized eligibility.                                               |
| `rosters.listMovements`      | Query    | `{ programKey?, season, kind?, limit? }`                                                                          | Bounded movement events joined to player identity.                                                                                     |
| `seasonalStats.listBySeason` | Query    | `{ programKey?, season }`                                                                                         | Bounded season stats merged with canonical roster players who have no participation record for the year, with normalized eligibility.  |
| `rosterAdmin.updatePlayer`   | Mutation | player, depth, eligibility, injury, position, and admin-key fields                                                | Atomically updates one program stint after server-side single-owner key verification.                                                  |
| `rosterAdmin.addPlayer`      | Mutation | identity, origin, entry type/school, roster facts, eligibility clocks, optional recruiting ratings, and admin key | Atomically creates the player, recruiting profile, active Michigan stint, zeroed career summary, and ranked arrival event.             |
| `rosterAdmin.removePlayer`   | Mutation | player, final Michigan season, departure kind, optional transfer destination, and admin key                       | Atomically marks an active stint departed, clears current-depth/availability fields, and adds the following-offseason departure event. |

All five roster/player read functions remain public and argument-validated. The shared foundation also exposes six team-data reads and four game-data reads. The hosted development deployment adds `ratings.listComposite`, `ratings.getMatchup`, and `rosterAdmin.updatePlayer`; its weekly dashboard prefers the proprietary snapshot over Elo. Checked-in source also defines `rosterAdmin.addPlayer` and `rosterAdmin.removePlayer`, which remain pending an authorized development push. Every roster mutation uses the same minimum-24-character `CFB26_ADMIN_KEY` stored in the target deployment and rejects before reading data when the key is absent or wrong. Feed synchronization and rating rebuilds are internal.

`ratingSystem.ts` owns the pure `cfb26-power-v1` and `cfb26-resume-v1` models. Power fits regularized scoring, neutral margin, special-teams, and team-home-field estimates from cutoff-safe games, including hidden FCS opponents and recursively faded performance priors. Résumé uses the edition’s average top-25 reference, venue-adjusted expected wins, and a 90/10 results/dominance split with overtime and blowout caps. `ratings.ts` builds immutable nightly, official, amendment, and research editions and adapts them to the existing dashboard/matchup reads. `ratingModel.ts`, vendor `ratingInputs.ts`, and `teamCompositeRatings` remain migration and benchmarking infrastructure only.

`ratingBacktest.ts` is the pure predictive-evaluation boundary. It builds season-held-out rolling folds with strict pre-kickoff feature cutoffs, reports margin MAE/Brier/calibration diagnostics across stable slices, fits regularized logistic margin calibration, and rejects model promotion when aggregate improvement hides a material held-out-season regression. It does not read or write Convex data.

`cfbdClient.ts` is the tested outbound contract for the rating system's approved CFBD inputs. It validates response shape, classifies authentication/rate-limit/server/contract failures, and bounds retries without exposing the key. `cfbdAudit.ts` reconciles one as-of-week game/stat/team dataset. `cfbdHealth.probe` is an internal, read-only canary across four required core endpoints and six optional preseason endpoints; it reports endpoint status without writing football rows. The canary becomes runnable in an environment only after that environment receives the checked-in function.

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
