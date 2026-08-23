# Current contracts

[Reference index](README.md) · [Wiki home](../README.md)

This page inventories observable interfaces that another part of the app—or a user—can currently depend on. Update it when a route, function, data shape, environment requirement, or public asset changes.

## Web routes

| Method/URL   | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                   | Data dependency                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `GET /`      | Renders the responsive Michigan personnel explorer with six primary views. Its depth chart uses offense, defense, and special-teams tabs with continuous position tables grouped into starters, rotation, depth, first/second-season prospects, and walk-ons. Green, yellow, and red rows distinguish pre-NFL, NFL-eligible, and final-eligibility seasons while preserving global search, loading/error/empty states, and player details. | `rosters.list`, `players.getProfile`, `seasonalStats.listBySeason`. |
| `GET /games` | Renders the responsive national landscape dashboard with season/week controls, weekly games, an all-team Elo table, and switchable national-importance/Michigan-relevance sorting. Before the credentialed import, it renders an explicit waiting state rather than sample games.                                                                                                                                                          | `ratings.getWeeklyDashboard`.                                       |

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
- Output: the player plus an optional recruiting profile, bounded stints, career summaries, seasonal stats, movement events, and optional draft outcome; `null` when the player does not exist. Returned stints use a five-season eligibility baseline plus `medicalExtensionSeasons` and omit the legacy redshirt field.
- Bound: related one-to-one records use unique indexes; growing related lists read at most 20.
- Authorization: none.

### `api.rosters.list`

- Kind: query.
- Input: `{ programKey?: string, status?: 'active' | 'committed' | 'departed', position?: string, limit?: number }`.
- Output: roster stints joined to canonical player documents. Returned stints use a five-season eligibility baseline plus `medicalExtensionSeasons` and omit the legacy redshirt field.
- Bound: 1–500, default 200. The current hosted implementation returns at most 200 for one status read, so the client completes departed history with exact-position reads.
- Authorization: none.

### `api.rosters.listMovements`

- Kind: query.
- Input: `{ programKey?: string, season: number, kind?: MovementKind, limit?: number }`.
- Output: movement events joined to canonical player documents.
- Bound: 1–500, default 200.
- Authorization: none.

### `api.seasonalStats.listBySeason`

- Kind: query.
- Input: `{ programKey?: string, season: number }`.
- Output: season-stat rows merged with canonical roster entries whose Michigan stint covers the requested season. Returned stints use a five-season eligibility baseline plus `medicalExtensionSeasons` and omit the legacy redshirt field. A `null` stat means zero snaps and a zero grade; a `null` player identifies a preserved source participant that has not been reconciled to the canonical player table.
- Bound: at most 200 indexed stat rows and 500 indexed candidate roster stints.
- Authorization: none.

### `api.teamData.listPrograms`

- Input: `{ limit?: number }`.
- Output: canonical program documents ordered by key.
- Bound: 1–500, default 500.
- Environment: development only until production promotion.

### `api.teamData.listRecruitingBySeason`

- Input: `{ season: number, limit?: number }`.
- Output: recruiting rows ordered by source rank.
- Bound: 1–500, default 200.
- Environment: development only until production promotion.

### `api.teamData.listStandingsBySeason`

- Input: `{ season: number, limit?: number }`.
- Output: standings and complete offense/defense per-game fields ordered by wins descending.
- Bound: 1–500, default 200.
- Environment: development only until production promotion.

### `api.teamData.listDraftByYear`

- Input: `{ year: number, limit?: number }`.
- Output: national draft selections ordered by overall pick.
- Bound: 1–500, default 300.
- Environment: development only until production promotion.

### `api.teamData.getProgramHistory`

- Input: `{ programKey: string, fromSeason: number, toSeason: number }`.
- Output: canonical program plus recruiting, standings, and national draft records in the requested range; `null` for an unknown program.
- Bound: an ordered range no wider than 50 years; at most 51 recruiting rows, 51 standings rows, and 500 selections.
- Environment: development only until production promotion.

### `api.teamData.getSyncState`

- Input: `{}`.
- Output: up to six feed status records with timestamps, accepted/rejected counts, and any failure.
- Bound: six indexed records covering recruiting, standings, draft, compact games, game stats, and Elo ratings.
- Environment: development only until production promotion.

### `api.games.listSeasonWeek`

- Input: `{ season: number, week: number, limit?: number }`.
- Output: compact schedule/result rows for one season week in start-time order.
- Bound: 1–500, default 200.
- Environment: development only until production promotion.

### `api.games.listProgramGames`

- Input: `{ programKey: string, fromSeason: number, toSeason: number, limit?: number }`.
- Output: canonical program plus its home and away games in reverse chronological order; `null` for an unknown program.
- Bound: an ordered range no wider than 50 years and 1–500 returned games, default 200.
- Environment: development only until production promotion.

### `api.games.listMatchup`

- Input: `{ programKeyA: string, programKeyB: string, limit?: number }`.
- Output: the two canonical programs plus their compact head-to-head history in reverse chronological order; `null` when either program is unknown.
- Bound: 1–500, default 100.
- Environment: development only until production promotion.

### `api.games.getGame`

- Input: `{ sourceGameId: number }`.
- Output: one compact game and up to two retained team-stat documents; `null` for an unknown game.
- Bound: one indexed game and two indexed team-stat rows.
- Environment: development only until production promotion.

### `api.ratings.list`

- Input: `{ season: number, limit?: number }`.
- Output: the selected season's latest Elo rows in descending order with a derived one-based rank.
- Bound: 1–200, default 150.
- Environment: development only until production promotion.

### `api.ratings.getWeeklyDashboard`

- Input: `{ season?: number, week?: number }`.
- Output: the resolved season/week, up to 200 Elo-ranked teams, and up to 200 FBS games decorated with ratings, ranks, national importance, Michigan importance, and a Michigan relationship label.
- Bound: indexed reads of at most 200 games, 200 ratings, 30 Michigan home games, and 30 Michigan away games. An omitted week resolves from the nearest stored game around the current date.
- Environment: development only until production promotion.

## Data

Both environments contain `seasonalPlayerStats` plus the eight lifecycle tables. Development additionally contains eight national-data support/fact tables, 22,169 compact games, 3,340 season ratings, 7,318 retained team-game stat rows, and two daily internal refresh jobs. See [Backend architecture](../architecture/backend.md), [Michigan player data interpretation](michigan-player-data-report.md), [Team-level historical data](team-level-data.md), and [Landscape ranking and game importance](landscape-ranking.md). There are no ownership fields, file-storage contracts, or HTTP endpoints.

## Document metadata and assets

- Route titles: `/` inherits `Michigan Football Personnel Archive`; `/games` sets `College Football Landscape | CFB26`.
- Viewport: responsive device width, initial scale 1.
- Global stylesheet: `src/styles/app.css`.
- Public assets: favicon ICO/PNG variants, Apple touch icon, Android Chrome icons, and `site.webmanifest`.
- The manifest and icons remain starter assets; the in-app Michigan wordmark is text/CSS, not a new public asset.

## Environment contract

`VITE_CONVEX_URL` may override the browser deployment. When omitted, the app uses the public development URL `https://adjoining-opossum-710.convex.cloud`. Development exposes every read required by both routes; production still exposes only the Michigan personnel contract and must not serve `/games` until an explicit backend promotion. See [Configuration](configuration.md) and [Deployment](../guides/deployment.md).

## Explicitly absent

No authentication/session contract, authorization policy, roster edit/write flow, REST/GraphQL API, upload flow, payment flow, analytics event, email integration, or notification system is integrated into the checked-in web app.
