# ADR 0001: TanStack Start and Convex foundation

[Decision index](README.md) · [Wiki home](../README.md)

- Status: Accepted
- Date: 2026-08-18

## Context

The repository needed a React application foundation with full-stack routing/rendering and a managed, typed, real-time backend. It also needed a small splash experience before the product domain and feature set were defined.

## Decision

Use:

- React with TanStack Start and file-based TanStack Router routes.
- Vite for development and production bundling.
- Tailwind CSS for styling.
- Convex for schema, persistence, server functions, and real-time client transport.
- React Query bridged to Convex for query lifecycle/cache integration.
- Vercel-oriented build orchestration through `vercel.json`.

Keep the initial domain disposable: a `numbers` table and sample functions demonstrate the integration without asserting product requirements.

## Consequences

### Benefits

- One TypeScript contract spans schema, backend functions, and React consumers.
- File routes make URL ownership discoverable.
- Convex removes the need for a separate API/database service during foundation work.
- The app can render through TanStack Start while retaining reactive Convex data.

### Costs and constraints

- Every runtime needs a valid Convex deployment URL, even for the static splash route under the current router construction.
- Backend development and hosted builds require Convex deployment credentials/configuration.
- Generated route and Convex files must be maintained through tooling.
- React Query plus Convex adds an integration layer that contributors must use consistently.
- Vercel is the documented host shape; choosing another host requires an explicit deployment design.

## Alternatives

No formal comparison of Next.js, a client-only Vite SPA, relational databases, or another hosting provider was recorded. Reconsider the decision only when a concrete product or operational requirement conflicts with the current consequences; record that change in a superseding ADR.
