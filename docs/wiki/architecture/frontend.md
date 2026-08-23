# Frontend architecture

[Architecture index](README.md) · [Wiki home](../README.md)

## Framework and rendering

The frontend uses React 19 through TanStack Start. TanStack Start supplies server/client rendering and file-based routing; there is no hand-written `main.tsx`. Vite assembles the runtime from `vite.config.ts`.

Because routes can render on the server, modules must not access `window`, `document`, storage, or other browser-only APIs at import time. Put those interactions in event handlers or client-safe effects.

## Router construction

`src/router.tsx` exports `getRouter()` and performs four jobs:

1. Reads the public `VITE_CONVEX_URL` build/runtime value.
2. Creates `ConvexQueryClient` and a React Query `QueryClient` using Convex's hash and query functions.
3. Connects both clients and creates a TanStack Router around the generated route tree.
4. Wraps every route in `ConvexProvider`.

Router defaults preload links on intent, restore scroll position, let React Query determine freshness, and render minimal fallback error/not-found output.

## Root document

`src/routes/__root.tsx` owns:

- UTF-8 and responsive viewport metadata.
- The current document title.
- Global CSS inclusion.
- favicon, Apple touch icon, and web manifest links.
- `<Outlet />` for the active route and `<Scripts />` for framework output.

Global providers belong in `src/router.tsx`; document-level metadata and markup belong in the root route.

## Current routes

| URL             | File                          | Role                                                                                                                                                                                                                                                                    | Convex dependency                                                   |
| --------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/`             | `src/routes/index.tsx`        | Client-rendered responsive personnel explorer with offense, defense, and special-teams depth tabs. Responsive position-table grids use eligibility-band row colors, prominent jersey numbers and recruiting years, tier overrides, injury states, and player detail UI. | `rosters.list`, `players.getProfile`, `seasonalStats.listBySeason`. |
| `/games`        | `src/routes/games.tsx`        | Responsive national landscape dashboard. Users select season/week, browse weekly importance, resort proprietary rankings through 15 strength perspectives, or build venue-aware head-to-head comparisons with nine matchup views and series history.                    | `ratings.getWeeklyDashboard`, `ratings.getMatchup`.                 |
| `/admin/roster` | `src/routes/admin.roster.tsx` | No-index single-owner editor for depth-tier overrides, extra eligibility, current injury state, and position changes. The key remains in component memory and is verified on every save.                                                                                | `rosters.list`, `rosterAdmin.updatePlayer`.                         |

`src/routeTree.gen.ts` is generated from route filenames. Do not edit it. Running development or build tooling regenerates it when route files change.

## Data access pattern

- One bounded active-roster read uses `useSuspenseQuery(convexQuery(api.rosters.list, args))` so the current depth chart paints first.
- The depth chart uses offense, defense, and special-teams tabs. Each tab lays its position rooms out in a responsive two-column grid at wide widths and a single column at narrower widths. Every room remains one continuous table with Starter, Rotation, Depth, Prospects, and Walk-ons row groups rather than separate player cards. The first recorded players fill a base 11-personnel offense, base defense, and K/P/LS unit. The checked-in [2015–2025 position-workload report](../reference/snap-count-position-workload-report.md) sizes broad QB, HB, WR, OL, IDL, EDGE, LB, and DB rotations; K, P, and LS each include the next listed player in rotation. Among remaining scholarship players, first- and second-season players are Prospects and older players are Depth; walk-ons retain their own tier. An admin override takes precedence over that automatic assignment. Player rows remain green for years one and two, yellow from year three until the last available season, and red in the final eligibility season; tier labels and table framing stay greyscale. The jersey-number column leads each player, missing numbers display `—`, and the original recruiting class appears as a prominent `Recruit YYYY` label. Injury badges remain inline with the player: dashed for short term, outlined for long term, and dark-filled for season-ending. The UI explicitly avoids presenting tiers as official starts or snap projections.
- Commitments and the historical archive hydrate in the background. The hosted list function caps one result at 200, so departed players use bounded position-specific reads and are deduplicated by player ID.
- Full profiles hydrate with a 12-request client concurrency limit through `players.getProfile`; the UI exposes progress and retry state while continuing to show roster data.
- The season-stat view reads one indexed 2015–2025 season at a time through React Query. It merges source participants with canonical roster players, treats a missing row as zero games, snaps, and grade, and names the season leaders.
- Player profiles derive career totals and peak seasons from the same seasonal records, then show every Michigan season in a compact production table. Eligibility details show the universal five-season window separately from any medical extension.
- Mutations use `useMutation(api.module.function)` from `convex/react`.
- Actions use `useAction(api.module.function)` from `convex/react`.
- Generated references come from `convex/_generated/api`.

React Query manages suspense/cache behavior for the roster reads while the Convex client performs the bounded profile hydration. The route opts out of SSR because its current data source is a browser-public development deployment and local Node TLS interception can make server fetches fail; the route-level loading UI covers that client startup.

The admin route also opts out of SSR. It reads the same bounded active roster, sorts the player selector locally, and calls the typed mutation directly. Its shared key is intentionally not stored in local/session storage or placed in the URL; a refresh clears it. This is a single-owner control documented in [ADR 0005](../decisions/0005-single-owner-roster-admin-key.md), not a user login.

The landscape route keeps `ratings.getWeeklyDashboard` reactive to season/week. Game sorting by national or Michigan importance and ranking-perspective sorting stay client-side over its bounded response. The matchup tab enables a second `ratings.getMatchup` read only when two distinct modeled teams are selected; venue is part of that query key. Ranking and projection methodology lives in [Proprietary team ratings and game importance](../reference/landscape-ranking.md).

## Styling

Tailwind CSS 4 is imported in `src/styles/app.css` through the Vite Tailwind plugin. The global layer sets the system sans-serif stack, rendering preferences, body margin/minimum width, and light/dark text/background defaults.

The explorer uses Michigan blue (`#00274C`) and maize (`#FFCB05`) with restrained pale tints, compact tables, sans-serif headings, and horizontal filter navigation. Blue anchors the header, headings, and active controls; maize marks emphasis, selection, and focus. Backgrounds remain flat and gradients are not used. Sections and dividers take priority over cards.

Keep the vertical rhythm tight. The outer container owns page padding; inner sections add only the separation their content needs. Do not repeat padding or margins at each level of the component tree. It is an implemented product direction, not final approved branding.

## Adding or changing a route

1. Choose the route URL and add the corresponding file under `src/routes/`.
2. Define it with `createFileRoute(...)`; keep route-specific loading/data/UI together until genuine reuse appears.
3. Add or reuse a typed Convex contract rather than fetching ad hoc.
4. Cover loading, empty, error, and narrow/wide viewport behavior.
5. Let route generation run; inspect generated diffs but do not edit them.
6. Update [Current contracts](../reference/current-contracts.md) when public routes or behavior change.
7. Run `npm run check` and visually inspect the affected URL.

## Known gaps

- Default router errors outside `/` expose stack text and should be replaced before a public production launch.
- Loading hundreds of full profiles through the existing one-player query is functional but request-heavy; add a bounded/paginated aggregate contract after backend deployment is authorized.
- No reusable component library, route-level test suite, analytics, or accessibility audit exists yet.
