# System overview

[Architecture index](README.md) · [Wiki home](../README.md)

## Runtime shape

```mermaid
flowchart LR
  B[Browser] <--> T[TanStack Start server/client]
  T --> R[TanStack Router]
  R --> Q[React Query]
  Q <--> CQC[ConvexQueryClient]
  CQC <--> C[Convex deployment]
  C --> DB[(Convex database)]
```

TanStack Start renders the React application and owns file-based routing. `getRouter()` creates a React Query client, connects it to `ConvexQueryClient`, and wraps the route tree in `ConvexProvider`. Components then use generated Convex references for typed reads and writes.

## Source-to-runtime boundaries

| Boundary             | Source                                       | Responsibility                                                                            |
| -------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Build/runtime        | `vite.config.ts`                             | Composes Tailwind, path aliases, TanStack Start, and React plugins; dev port is 3000.     |
| Router and providers | `src/router.tsx`                             | Creates the router, React Query cache, Convex client, preload policy, and default errors. |
| Root document        | `src/routes/__root.tsx`                      | Defines HTML shell, global metadata/assets, stylesheet, scripts, and route outlet.        |
| Route UI             | `src/routes/*.tsx`                           | Defines URL-addressable components and route-specific data use.                           |
| Backend              | `convex/*.ts`                                | Defines database schema and server queries, mutations, and actions.                       |
| Generated contracts  | `src/routeTree.gen.ts`, `convex/_generated/` | Carries generated route and backend types; never hand-edited.                             |

## Current request paths

### Michigan personnel explorer

1. A browser requests `/`.
2. The client-rendered index route makes one bounded `rosters.list` read for active players and paints the current depth chart.
3. A commitment read plus position-specific departed reads hydrate in the background to work around the hosted function's 200-row cap, then the client deduplicates all 428 roster entries by player ID.
4. Up to 12 concurrent `players.getProfile` reads progressively add recruiting, career, seasonal, movement, and draft details as players are discovered.
5. `seasonalStats.listBySeason` reads one bounded 2015–2025 season and merges participants with zero-snap roster players.
6. Search and the six views derive from the typed records without a separate REST layer or client data copy.

## Build and deployment path

```mermaid
flowchart LR
  G[Git commit] --> V[Vercel build]
  V --> D[npx convex deploy]
  D --> CB[Convex backend]
  D --> W[npm run build]
  W --> A[Web deployment]
```

`vercel.json` defines `npx convex deploy --cmd 'npm run build'`. The deployment needs credentials for the selected Convex project and must expose the resulting Convex URL to the web build. No Vercel project identifier or production URL is stored in the repository today.

The Convex source is aligned in development and production. Vercel project ownership, credentials, and the production web URL still need to be configured and verified before the hosted web pipeline is considered connected.

## Deliberate boundaries

- There is no separate REST or Express server. Convex is the data/backend boundary.
- There is no authentication provider or authorization layer.
- There is no HTTP route module under `convex/http.ts`.
- There is no separate design-system package, test package, monorepo, or shared library.
- There is no service worker or offline data layer beyond the generated web manifest.

Introduce a new boundary only when a product requirement cannot be served cleanly by the current stack, and record durable choices in an ADR.
