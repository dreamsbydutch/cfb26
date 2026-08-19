---
name: frontend-work
description: "Implement or review cfb26 browser-facing work: React components, TanStack Start file routes, pages, layouts, metadata, Tailwind styling, responsive design, accessibility, or client-side Convex reads. Trigger on frontend, UI, UX, route, page, component, splash page, landing page, layout, CSS, Tailwind, responsive, accessibility, or browser requests; skip backend-only schema and function work."
metadata:
  short-description: "React routes, Tailwind, and browser UI"
  keywords: "frontend, React, TanStack Start, route, page, component, UI, UX, Tailwind, CSS, responsive, accessibility"
---

# Frontend Work

Build a coherent user-facing change that preserves the app's TanStack Start, React Query, and Convex integration.

## Read first

1. Read [AGENTS.md](../../../AGENTS.md).
2. Read [Frontend architecture](../../../docs/wiki/architecture/frontend.md).
3. For data-bound UI, also read [Backend architecture](../../../docs/wiki/architecture/backend.md).

## Work in the established boundaries

- Add file routes under `src/routes/`; do not edit `src/routeTree.gen.ts`.
- Put shared global styling in `src/styles/app.css`; prefer local Tailwind classes for route-specific design.
- Configure document-wide metadata, links, and providers in `src/routes/__root.tsx` or `src/router.tsx` only when their scope is global.
- Use `~/` for imports rooted at `src/` and generated `api` references for Convex functions.
- Keep browser-only APIs and side effects out of server render paths.
- Preserve the existing visual language unless the request establishes a new one. Do not add a component library for a small change.

## Data-bound UI

- Use `convexQuery(...)` with React Query for reactive reads and `useMutation`/`useAction` from `convex/react` for writes and actions.
- Render loading, empty, success, and error states appropriate to the interaction.
- Do not invent a backend contract in the component. If the required function or schema does not exist, make the backend change with `$convex-work` or state the dependency.

## Quality bar

- Use semantic elements, keyboard-accessible controls, visible focus states, and meaningful text.
- Check narrow and wide layouts. Avoid fixed dimensions that clip translated, zoomed, or long content.
- Keep route components readable; extract a component when it has independent behavior or real reuse, not just to reduce line count.
- Update the wiki when routes, visual conventions, public behavior, or client data flow change.

Run `npm run typecheck` during implementation and `npm run check` before handoff. When a browser preview is available, visually inspect the affected route and its responsive states.
