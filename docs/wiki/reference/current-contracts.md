# Current contracts

[Reference index](README.md) · [Wiki home](../README.md)

This page inventories observable interfaces that another part of the app—or a user—can currently depend on. Update it when a route, function, data shape, environment requirement, or public asset changes.

## Web routes

| Method/URL | Behavior                                                                                                                                                                                                                                                                                                    | Data dependency                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `GET /`    | Renders the responsive Michigan personnel explorer with six primary views. Its depth chart uses offense, defense, and special-teams tabs; every position room presents starters, rotation, prospects, and walk-ons together while preserving global search, loading/error/empty states, and player details. | `rosters.list`, `players.getProfile`, `seasonalStats.listBySeason`. |

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

## Data

The checked-in and hosted model contains `seasonalPlayerStats` plus the eight lifecycle tables in both environments. See [Backend architecture](../architecture/backend.md) for indexes and [Michigan player data interpretation](michigan-player-data-report.md) for the field-level reading contract. There are no ownership fields, file-storage contracts, scheduled jobs, or HTTP endpoints.

## Document metadata and assets

- Current title: `Michigan Football Personnel Archive`.
- Viewport: responsive device width, initial scale 1.
- Global stylesheet: `src/styles/app.css`.
- Public assets: favicon ICO/PNG variants, Apple touch icon, Android Chrome icons, and `site.webmanifest`.
- The manifest and icons remain starter assets; the in-app Michigan wordmark is text/CSS, not a new public asset.

## Environment contract

`VITE_CONVEX_URL` may override the browser deployment. When omitted, the app uses the public development URL `https://adjoining-opossum-710.convex.cloud`. Both recorded deployments expose the read identifiers required by the UI. See [Configuration](configuration.md) and [Deployment](../guides/deployment.md).

## Explicitly absent

No authentication/session contract, authorization policy, roster edit/write flow, REST/GraphQL API, upload flow, payment flow, analytics event, email integration, or notification system is integrated into the checked-in web app.
