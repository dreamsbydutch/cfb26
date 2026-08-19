# Current contracts

[Reference index](README.md) · [Wiki home](../README.md)

This page inventories observable interfaces that another part of the app—or a user—can currently depend on. Update it when a route, function, data shape, environment requirement, or public asset changes.

## Web routes

| Method/URL         | Behavior                                                                                          | Data dependency                                            |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `GET /`            | Renders the responsive “Start with a blank canvas” splash page with external documentation links. | No function call; router still requires `VITE_CONVEX_URL`. |
| `GET /anotherPage` | Renders recent numbers and a button that adds a random number through an action.                  | `listNumbers`, `myAction`.                                 |

Unknown URLs render the root route's `Route not found` fallback. Router-level errors currently render stack text.

## Convex API

### `api.myFunctions.listNumbers`

- Kind: query.
- Input: `{ count: number }`.
- Output: `{ viewer: string | null, numbers: number[] }`.
- Ordering: selects newest by creation time, then reverses the selected set for oldest-to-newest display.
- Bound: reads at most `count`; callers are currently responsible for a sensible positive count.
- Authorization: none.

### `api.myFunctions.addNumber`

- Kind: mutation.
- Input: `{ value: number }`.
- Output: no explicit value.
- Effect: inserts one `numbers` document and logs its ID.
- Authorization: none.

### `api.myFunctions.myAction`

- Kind: action.
- Input: `{ first: number }`.
- Output: no explicit value.
- Effect: queries ten recent values, logs the result, and invokes `addNumber({ value: first })`.
- Authorization: none.

## Data

```text
numbers
|-- _id: generated Convex document ID
|-- _creationTime: generated timestamp
`-- value: number
```

There are no additional product tables, indexes, ownership fields, file storage contracts, scheduled jobs, HTTP endpoints, or migrations.

## Document metadata and assets

- Current title: `A new beginning — T3 / Convex`.
- Viewport: responsive device width, initial scale 1.
- Global stylesheet: `src/styles/app.css`.
- Public assets: favicon ICO/PNG variants, Apple touch icon, Android Chrome icons, and `site.webmanifest`.
- The manifest and icons are starter assets, not finalized branding.

## Environment contract

The application expects `VITE_CONVEX_URL` to contain a valid public Convex deployment URL. See [Configuration](configuration.md) for local and hosted deployment variables.

## Explicitly absent

No authentication/session contract, authorization policy, user profile, REST/GraphQL API, upload flow, payment flow, analytics event, email integration, notification system, or product-domain entity is implemented.
