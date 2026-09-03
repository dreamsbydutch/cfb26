# Current contracts

[Reference index](README.md) · [Wiki home](../README.md)

This page inventories observable interfaces that another part of the app—or a user—can currently depend on. Update it when a route, function, data shape, environment requirement, or public asset changes.

The checked-in backend also defines `internal.cfbdHealth.probe({ season, week })`, a read-only operational canary returning configuration status plus ten endpoint results with required/optional status, latency, row count, classified error details, and warnings. It is not a browser-facing API and becomes callable only after an authorized push to the selected deployment.

## Web routes

| Method/URL          | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Data dependency                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`             | Renders the responsive Michigan personnel explorer with six primary views. Its depth chart uses offense, defense, and special-teams tabs with continuous position tables grouped into starters, rotation, depth, first/second-season prospects, and walk-ons. Green, yellow, and red row backgrounds communicate the eligibility bands; jersey numbers lead each row, original recruiting years appear as plain secondary text, and injuries use one, two, or three inline red medical crosses for short-term, long-term, or season-ending severity. Recruit classes use season tables that can rank players by Composite or 247 rating, keep unrated players last, and add a wide-screen positional breakdown. Player drawers expose compact public player facts and aligned Composite/247 recruiting rows without eligibility or admin-override fields. | `rosters.list`, `players.getProfile`, `seasonalStats.listBySeason`.                                                                             |
| `GET /games`        | Renders the national landscape dashboard with season/week controls, one evidence-rich points-scale Power Rank, game ordering by matchup quality, playoff importance, or Michigan importance, optional TV outlets, and a matchup lab. Résumé becomes supporting evidence in Week 7. Matchup users choose two teams and venue to see scores, win probability, unit edges, team-specific home field, and stored series history.                                                                                                                                                                                                                                                                                                                                                                                                                              | `ratings.getWeeklyDashboard`, `ratings.getMatchup`.                                                                                             |
| `GET /admin/roster` | Renders the no-index single-owner roster movement desk. Edit provides searchable active-player maintenance; Add records a recruit, transfer, or walk-on with identity, origin, roster/recruiting measurements, separate arrival/eligibility clocks, and optional ratings; Remove records a confirmed transfer, graduation, retirement, or dismissal without deleting history. The access key remains in page memory and every write is verified by Convex.                                                                                                                                                                                                                                                                                                                                                                                                | `rosters.list`, `players.getProfile`, `teamData.listPrograms`, `rosterAdmin.updatePlayer`, `rosterAdmin.addPlayer`, `rosterAdmin.removePlayer`. |

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

### `api.rosterAdmin.addPlayer`

- Kind: mutation.
- Input: canonical name/origin fields; recruit, transfer, or walk-on entry type; required previous program for transfers and optional previous program for walk-ons; roster position/number/measurements; original recruiting class/profile/optional ratings; Michigan arrival and eligibility clocks; and `adminKey`.
- Output: the new player ID and normalized active roster stint.
- Writes: one atomic transaction creates the canonical player, recruiting profile, Michigan stint, zeroed career summary, and arrival movement. Cohort rank is assigned from the existing arrival-season/source group; NFL eligibility and the five-season end are derived from the supplied clocks.
- Validation: text, football positions, seasons, jersey, measurements, extensions, ratings, ranks, prior-program rules, and duplicate canonical/lifecycle identity are bounded/checked.
- Authorization: the same exact server-side comparison against a minimum-24-character `CFB26_ADMIN_KEY`, before roster reads.
- Environment: checked in; authorized development push pending. Production promotion and a distinct production key remain pending.

### `api.rosterAdmin.removePlayer`

- Kind: mutation.
- Input: active player/program identity, final Michigan season, departure kind, required destination for a transfer, and `adminKey`.
- Output: the canonical player and normalized departed stint.
- Writes: one atomic transaction marks the stint departed, clears current depth/injury facts, and creates the following-offseason transfer, graduation, retirement, or dismissal event. It does not delete the player or prior history.
- Validation: active status, season order, destination rules, and absence of an existing departure are checked.
- Authorization: the same exact server-side comparison against a minimum-24-character `CFB26_ADMIN_KEY`, before roster reads.
- Environment: checked in; authorized development push pending. Production promotion and a distinct production key remain pending.

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
- Output: the resolved season/week, selected immutable edition metadata, up to 200 published Power rows with unit ratings, source/prior evidence, and optional Week 7 Résumé context, plus up to 200 FBS games decorated with team ranks, projected margin, competitiveness, matchup quality, playoff leverage/importance, Michigan importance, a Michigan relationship label, and optional TV outlets. Reads fall back to the legacy composite and then Elo only when no new edition exists.
- Bound: indexed reads of at most 200 games, 600 edition rows, 200 legacy composite rows, 200 Elo rows, 30 Michigan home games, and 30 Michigan away games. An omitted week resolves from the nearest stored game around the current date.
- Environment: checked-in source; development and production remain on earlier contracts until promotion.

### `api.ratings.listComposite`

- Input: `{ season: number, limit?: number }`.
- Output: legacy stored percentile-composite rows in descending overall order. This migration read is not the active rating direction.
- Bound: 1–200, default 150.
- Environment: development; production promotion pending.

### `api.ratings.getMatchup`

- Input: `{ season: number, programKeyA: string, programKeyB: string, venue: 'neutral' | 'team_a' | 'team_b' }`.
- Output: the two programs and preferred-edition team rows, a points-scale projected score/margin/win probability with its calibration version, Power/offense/defense/special-teams/home-field comparisons, and a 2000-or-later series summary with the last five stored meetings. It uses the legacy composite only when no new edition exists and returns `null` when either team is unavailable.
- Bound: two indexed program reads, at most 30 indexed edition records, two indexed snapshot reads, two indexed legacy reads, and at most 50 indexed matchup games.
- Environment: checked-in source; hosted promotion pending.

## Data

The shared 17-table foundation still contains `seasonalPlayerStats`, the lifecycle tables, 22,169 compact games, 3,340 Elo rows, and 7,318 retained team-game stat rows. Development additionally has the prior two rating tables and composite snapshots. Checked-in source adds immutable `ratingEditions` and `teamRatingSnapshots`, but neither hosted environment has received them. Existing lifecycle tables accept bounded owner-maintained player facts; checked-in mutations can add or close normalized lifecycles without creating fake legacy-import rows. No owner-authored hosted records exist yet. See [Backend architecture](../architecture/backend.md), [Michigan player data interpretation](michigan-player-data-report.md), [Team-level historical data](team-level-data.md), and [Proprietary team ratings and game importance](landscape-ranking.md). There are no user ownership fields, file-storage contracts, or HTTP endpoints.

## Document metadata and assets

- Route titles: `/` inherits `Michigan Football Personnel Archive`; `/games` sets `College Football Landscape | CFB26`; `/admin/roster` sets `Roster Admin | CFB26` and `noindex, nofollow` robots metadata.
- Viewport: responsive device width, initial scale 1.
- Global stylesheet: `src/styles/app.css`.
- Public assets: favicon ICO/PNG variants, Apple touch icon, Android Chrome icons, and `site.webmanifest`.
- The manifest and icons remain starter assets; the in-app Michigan wordmark is text/CSS, not a new public asset.

## Environment contract

`VITE_CONVEX_URL` may override the browser deployment. When omitted, the app uses the public development URL `https://adjoining-opossum-710.convex.cloud`, which still exposes the prior composite model and earlier update mutation. `CFB26_ADMIN_KEY` belongs only in each target Convex deployment and enables the roster mutations installed there. The checked-in roster changes and 21-table Power/Résumé contract need an authorized development push; production requires an explicit later promotion. See [Configuration](configuration.md) and [Deployment](../guides/deployment.md).

## Explicitly absent

No identity provider, user/session contract, roles system, REST/GraphQL API, upload flow, payment flow, analytics event, email integration, or notification system is integrated into the checked-in web app. The roster editor is the sole write flow and uses a deployment-secret gate for one owner; it must not be treated as a general authentication system.
