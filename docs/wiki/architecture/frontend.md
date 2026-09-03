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

| URL             | File                          | Role                                                                                                                                                                                                                                                                    | Convex dependency                                                                                 |
| --------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/`             | `src/routes/index.tsx`        | Client-rendered responsive personnel explorer with offense, defense, and special-teams depth tabs. Responsive position-table grids use eligibility-band row colors, prominent jersey numbers and recruiting years, tier overrides, injury states, and player detail UI. | `rosters.list`, `players.getProfile`, `seasonalStats.listBySeason`.                               |
| `/games`        | `src/routes/games.tsx`        | Responsive national landscape dashboard. Users select season/week, inspect one points-scale Power ranking with its evidence, order games by matchup quality, playoff importance, or Michigan importance, and build venue-aware head-to-head comparisons.                | `ratings.getWeeklyDashboard`, `ratings.getMatchup`.                                               |
| `/admin/roster` | `src/routes/admin.roster.tsx` | No-index single-owner movement desk with searchable player maintenance, complete recruit/transfer/walk-on arrivals, and confirmed history-preserving departures. The key remains in component memory and is verified on every write.                                    | `rosters.list`, `players.getProfile`, `teamData.listPrograms`, and three `rosterAdmin` mutations. |

`src/routeTree.gen.ts` is generated from route filenames. Do not edit it. Running development or build tooling regenerates it when route files change.

## Data access pattern

- One bounded active-roster read uses `useSuspenseQuery(convexQuery(api.rosters.list, args))` so the current depth chart paints first.
- The depth chart uses offense, defense, and special-teams tabs. Each tab lays its position rooms out in a responsive two-column grid at wide widths and a single column at narrower widths. Every room remains one continuous table with Starter, Rotation, Depth, Prospects, and Walk-ons row groups rather than separate player cards. The first recorded players fill a base 11-personnel offense, base defense, and K/P/LS unit. The checked-in [2015–2025 position-workload report](../reference/snap-count-position-workload-report.md) sizes broad QB, HB, WR, OL, IDL, EDGE, LB, and DB rotations; K, P, and LS each include the next listed player in rotation. Among remaining scholarship players, first- and second-season players are Prospects and older players are Depth; walk-ons retain their own tier. An admin override takes precedence over that automatic assignment. Player rows remain green for years one and two, yellow from year three until the last available season, and red in the final eligibility season; tier labels and table framing stay greyscale. The jersey-number column leads each player, missing numbers display `—`, and the original recruiting class year sits beside the player name as plain secondary text. Compact red medical crosses remain inline with the player: one for short term, two for long term, and three for season-ending. The UI explicitly avoids presenting tiers as official starts or snap projections.
- Commitments and the historical archive hydrate in the background. The hosted list function caps one result at 200, so departed players use bounded position-specific reads and are deduplicated by player ID.
- Full profiles hydrate with a 12-request client concurrency limit through `players.getProfile`; the UI exposes progress and retry state while continuing to show roster data.
- Recruit classes render as season tables with player, recruit-time position, stars, Composite rating, 247 rating, overall ranks, and acquisition type. A two-option control ranks every visible class by either rating source; missing ratings sort last and remain explicitly unrated. Narrow screens prioritize rank, player, stars, and the selected rating, while tablet widths restore the secondary columns. Wide screens pair each season table with a recruit-time positional breakdown rather than stretching the table across the full content width.
- The season-stat view reads one indexed 2015–2025 season at a time through React Query. It merges source participants with canonical roster players, treats a missing row as zero games, snaps, and grade, and names the season leaders.
- Player profiles derive career totals and peak seasons from the same seasonal records, then show every Michigan season in a compact production table. The public drawer keeps player facts to position, height, weight, high school, and combined hometown/state; eligibility-window and admin-override fields remain background data. Recruiting details emphasize the original class and star level, followed by aligned Composite and 247 rating, overall-rank, position-rank, and state-rank rows. Stars use the Composite overall/rating bands when present, fall back to the 247 rating band, and otherwise display as unrated.
- Mutations use `useMutation(api.module.function)` from `convex/react`.
- Actions use `useAction(api.module.function)` from `convex/react`.
- Generated references come from `convex/_generated/api`.

React Query manages suspense/cache behavior for the roster reads while the Convex client performs the bounded profile hydration. The route opts out of SSR because its current data source is a browser-public development deployment and local Node TLS interception can make server fetches fail; the route-level loading UI covers that client startup.

The admin route also opts out of SSR. It reads the same bounded active roster plus the bounded canonical-program list used by transfer school selectors. Edit and remove tasks use a searchable active-player list; add dynamically asks for the fields relevant to a recruit, transfer, or walk-on and keeps optional recruiting ratings collapsed. Removal requires an explicit confirmation and explains that history remains intact. Loading, empty, mutation-success/error, and route-error states are handled in the feature.

The shared key is intentionally not stored in local/session storage or placed in the URL; a refresh clears it. All three typed mutations receive it and verify it server-side before reading data. This is a single-owner control documented in [ADR 0005](../decisions/0005-single-owner-roster-admin-key.md), not a user login. The checked-in add/remove calls require the matching Convex functions to be pushed before those two tasks work against a hosted deployment.

The landscape route keeps `ratings.getWeeklyDashboard` reactive to season/week. There is one predictive ordering: CFB26 Power Rank. Its table keeps Power, offense, defense, special teams, team-specific home field, games played, prior influence, sources, and limited-sample status together; Week 7 Résumé appears only as supporting evidence. Game ordering stays client-side over the bounded response and offers three independent lenses: matchup quality, national playoff importance, and Michigan importance. Optional CFBD television outlets appear beside venue information. The matchup tab enables a second `ratings.getMatchup` read only when two distinct modeled teams are selected; venue is part of that query key. Ranking and projection methodology lives in [Proprietary team ratings and game importance](../reference/landscape-ranking.md).

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
