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

## Current route

| URL | File                   | Role                                                                                     | Convex dependency                                                   |
| --- | ---------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/` | `src/routes/index.tsx` | Client-rendered responsive personnel explorer with loading, error, empty, and detail UI. | `rosters.list`, `players.getProfile`, `seasonalStats.listBySeason`. |

`src/routeTree.gen.ts` is generated from route filenames. Do not edit it. Running development or build tooling regenerates it when route files change.

## Data access pattern

- One bounded active-roster read uses `useSuspenseQuery(convexQuery(api.rosters.list, args))` so the current depth chart paints first.
- Commitments and the historical archive hydrate in the background. The hosted list function caps one result at 200, so departed players use bounded position-specific reads and are deduplicated by player ID.
- Full profiles hydrate with a 12-request client concurrency limit through `players.getProfile`; the UI exposes progress and retry state while continuing to show roster data.
- The season-stat view reads one indexed 2015–2025 season at a time through React Query. It merges source participants with canonical roster players, treating a missing participation row as zero snaps and a zero grade.
- Mutations use `useMutation(api.module.function)` from `convex/react`.
- Actions use `useAction(api.module.function)` from `convex/react`.
- Generated references come from `convex/_generated/api`.

React Query manages suspense/cache behavior for the roster reads while the Convex client performs the bounded profile hydration. The route opts out of SSR because its current data source is a browser-public development deployment and local Node TLS interception can make server fetches fail; the route-level loading UI covers that client startup.

## Styling

Tailwind CSS 4 is imported in `src/styles/app.css` through the Vite Tailwind plugin. The global layer sets the system sans-serif stack, rendering preferences, body margin/minimum width, and light/dark text/background defaults.

The explorer uses Michigan navy and maize with warm-neutral surfaces, compact roster tables, serif display headings, and responsive horizontal filter navigation. It is an implemented product direction, not final approved branding.

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
