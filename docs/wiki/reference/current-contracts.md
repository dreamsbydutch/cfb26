# Current contracts

[Reference index](README.md) · [Wiki home](../README.md)

This page inventories observable interfaces that another part of the app—or a user—can currently depend on. Update it when a route, function, data shape, environment requirement, or public asset changes.

## Web routes

| Method/URL          | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Data dependency                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `GET /`             | Renders the responsive Michigan personnel explorer with six primary views. Its depth chart uses offense, defense, and special-teams tabs with continuous position tables grouped into starters, rotation, depth, first/second-season prospects, and walk-ons. Green, yellow, and red row backgrounds communicate the eligibility bands; jersey numbers lead each row, original recruiting years appear as plain secondary text, and short-term, long-term, and season-ending injuries use distinct inline treatments. | `rosters.list`, `players.getProfile`, `seasonalStats.listBySeason`. |
| `GET /games`        | Renders the national landscape dashboard with season/week controls, weekly importance, multi-perspective proprietary rankings, and a matchup lab. Rankings can be resorted through 15 strength perspectives; matchup users choose two teams and venue to see scores, win probability, complementary-unit edges, coverage, and stored series history.                                                                                                                                                                  | `ratings.getWeeklyDashboard`, `ratings.getMatchup`.                 |
| `GET /admin/roster` | Renders the no-index single-owner roster editor. An admin can choose an active player, confirm the player's original recruiting year, override the depth-chart section, add eligibility seasons, set or clear one of three injury states, and record a position change. The access key remains in page memory and every write is verified by Convex.                                                                                                                                                                  | `rosters.list`, `players.getProfile`, `rosterAdmin.updatePlayer`.   |

Unknown URLs render the root route's `Route not found` fallback. Router-level errors currently render stack text.

## Convex API

### `api.players.search`

- Kind: query.
- Input: `{ searchText: string, homeState?: string, limit?: number }`.
- Output: matching player documents.
- Bound: 1–500, default 25; an empty trimmed search returns no rows.
- Authorization: none.

### `api.players.getProfile`

- Kind: query.
- Input: `{ playerId: Id<'players'> }`.
- Output: the player plus an optional recruiting profile, bounded stints, career summaries, seasonal stats, movement events, and optional draft outcome; `null` when the player does not exist. Returned stints apply the shared five-season-plus-extensions normalizer and include any public owner annotations.
- Bound: related one-to-one records use unique indexes; growing related lists read at most 20.
- Authorization: none.

### `api.rosters.list`

- Kind: query.
- Input: `{ programKey?: string, status?: 'active' | 'committed' | 'departed', position?: string, limit?: number }`.
- Output: roster stints joined to canonical player documents. Returned stints use a five-season eligibility baseline plus medical and admin-granted extra seasons, omit the legacy redshirt field, and may include a depth-tier override, current injury, and bounded position-change history.
- Bound: 1–500, default 200. The current hosted implementation returns at most 200 for one status read, so the client completes departed history with exact-position reads.
- Authorization: none.

### `api.rosterAdmin.updatePlayer`

- Kind: mutation.
- Input: the player/program identity, desired depth-tier override, current position, effective season, zero to five extra eligibility seasons, optional position-change note, optional injury state/details, and `adminKey`.
- Output: the normalized updated roster stint.
- Validation: position labels, seasons, eligibility count, notes, and expected-return text are bounded. Position changes append to a maximum 20-entry history. The update is atomic.
- Authorization: exact server-side comparison against a minimum-24-character `CFB26_ADMIN_KEY`; the mutation rejects before reading roster data when the key is absent or wrong.
- Environment: development function deployed; writes remain disabled until the development deployment key is configured. Production promotion and a separate production key are pending.

### `api.rosters.listMovements`

- Kind: query.
- Input: `{ programKey?: string, season: number, kind?: MovementKind, limit?: number }`.
- Output: movement events joined to canonical player documents.
- Bound: 1–500, default 200.
- Authorization: none.

### `api.seasonalStats.listBySeason`

- Kind: query.
- Input: `{ programKey?: string, season: number }`.
- Output: season-stat rows merged with canonical roster entries whose Michigan stint covers the requested season. Returned stints apply the shared eligibility normalizer and include any public owner annotations. A `null` stat means zero snaps and a zero grade; a `null` player identifies a preserved source participant that has not been reconciled to the canonical player table.
- Bound: at most 200 indexed stat rows and 500 indexed candidate roster stints.
- Authorization: none.

### `api.teamData.listPrograms`

- Input: `{ limit?: number }`.
- Output: canonical program documents ordered by key.
- Bound: 1–500, default 500.
- Environment: development and production.

### `api.teamData.listRecruitingBySeason`

- Input: `{ season: number, limit?: number }`.
- Output: recruiting rows ordered by source rank.
- Bound: 1–500, default 200.
- Environment: development and production.

### `api.teamData.listStandingsBySeason`

- Input: `{ season: number, limit?: number }`.
- Output: standings and complete offense/defense per-game fields ordered by wins descending.
- Bound: 1–500, default 200.
- Environment: development and production.

### `api.teamData.listDraftByYear`

- Input: `{ year: number, limit?: number }`.
- Output: national draft selections ordered by overall pick.
- Bound: 1–500, default 300.
- Environment: development and production.

### `api.teamData.getProgramHistory`

- Input: `{ programKey: string, fromSeason: number, toSeason: number }`.
- Output: canonical program plus recruiting, standings, and national draft records in the requested range; `null` for an unknown program.
- Bound: an ordered range no wider than 50 years; at most 51 recruiting rows, 51 standings rows, and 500 selections.
- Environment: development and production.

### `api.teamData.getSyncState`

- Input: `{}`.
- Output: up to seven feed status records with timestamps, accepted/rejected counts, warnings, and any failure.
- Bound: seven indexed records covering recruiting, standings, draft, compact games, game stats, Elo, and advanced rating inputs.
- Environment: development and production.

### `api.games.listSeasonWeek`

- Input: `{ season: number, week: number, limit?: number }`.
- Output: compact schedule/result rows for one season week in start-time order.
- Bound: 1–500, default 200.
- Environment: development and production.

### `api.games.listProgramGames`

- Input: `{ programKey: string, fromSeason: number, toSeason: number, limit?: number }`.
- Output: canonical program plus its home and away games in reverse chronological order; `null` for an unknown program.
- Bound: an ordered range no wider than 50 years and 1–500 returned games, default 200.
- Environment: development and production.

### `api.games.listMatchup`

- Input: `{ programKeyA: string, programKeyB: string, limit?: number }`.
- Output: the two canonical programs plus their compact head-to-head history in reverse chronological order; `null` when either program is unknown.
- Bound: 1–500, default 100.
- Environment: development and production.

### `api.games.getGame`

- Input: `{ sourceGameId: number }`.
- Output: one compact game and up to two retained team-stat documents; `null` for an unknown game.
- Bound: one indexed game and two indexed team-stat rows.
- Environment: development and production.

### `api.ratings.list`

- Input: `{ season: number, limit?: number }`.
- Output: the selected season's latest Elo rows in descending order with a derived one-based rank.
- Bound: 1–200, default 150.
- Environment: development and production.

### `api.ratings.getWeeklyDashboard`

- Input: `{ season?: number, week?: number }`.
- Output: the resolved season/week, up to 200 composite-ranked teams, and up to 200 FBS games decorated with overall ratings, ranks, national importance, Michigan importance, and a Michigan relationship label. It falls back to normalized Elo only if the selected season has no composite snapshot.
- Bound: indexed reads of at most 200 games, 200 composite rows, 200 Elo rows, 30 Michigan home games, and 30 Michigan away games. An omitted week resolves from the nearest stored game around the current date.
- Environment: development; production retains the previous Elo-backed implementation until promotion.

### `api.ratings.listComposite`

- Input: `{ season: number, limit?: number }`.
- Output: stored `cfb26-composite-v1` team rows in descending overall order, including rank, 16 perspectives, confidence, signal/source counts, and model metadata.
- Bound: 1–200, default 150.
- Environment: development; production promotion pending.

### `api.ratings.getMatchup`

- Input: `{ season: number, programKeyA: string, programKeyB: string, venue: 'neutral' | 'team_a' | 'team_b' }`.
- Output: the two programs and composite rows, a projected score/margin/win probability, nine matchup-type comparisons, and a 2000-or-later series summary with the last five stored meetings; `null` when either program or composite row is unavailable.
- Bound: two indexed program reads, two indexed composite reads, and at most 50 indexed matchup games.
- Environment: development; production promotion pending.

## Data

The shared 17-table foundation still contains `seasonalPlayerStats`, the lifecycle tables, 22,169 compact games, 3,340 Elo rows, and 7,318 retained team-game stat rows. Development additionally has the two checked-in rating tables, 2000–2026 composite snapshots, 2025–2026 advanced inputs, and a third daily refresh job. The existing `rosterStints` table now accepts bounded owner-authored depth, eligibility, injury, and position metadata; no such annotations have been added yet. See [Backend architecture](../architecture/backend.md), [Michigan player data interpretation](michigan-player-data-report.md), [Team-level historical data](team-level-data.md), and [Proprietary team ratings and game importance](landscape-ranking.md). There are no user ownership fields, file-storage contracts, or HTTP endpoints.

## Document metadata and assets

- Route titles: `/` inherits `Michigan Football Personnel Archive`; `/games` sets `College Football Landscape | CFB26`; `/admin/roster` sets `Roster Admin | CFB26` and `noindex, nofollow` robots metadata.
- Viewport: responsive device width, initial scale 1.
- Global stylesheet: `src/styles/app.css`.
- Public assets: favicon ICO/PNG variants, Apple touch icon, Android Chrome icons, and `site.webmanifest`.
- The manifest and icons remain starter assets; the in-app Michigan wordmark is text/CSS, not a new public asset.

## Environment contract

`VITE_CONVEX_URL` may override the browser deployment. When omitted, the app uses the public development URL `https://adjoining-opossum-710.convex.cloud`, which exposes the proprietary model. `CFB26_ADMIN_KEY` belongs only in each target Convex deployment and enables the roster mutation there. Production still needs the checked-in 19-table contract, functions, snapshots, and a separately chosen admin key promoted before it exposes the same behavior. See [Configuration](configuration.md) and [Deployment](../guides/deployment.md).

## Explicitly absent

No identity provider, user/session contract, roles system, REST/GraphQL API, upload flow, payment flow, analytics event, email integration, or notification system is integrated into the checked-in web app. The roster editor is the sole write flow and uses a deployment-secret gate for one owner; it must not be treated as a general authentication system.
