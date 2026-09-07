# Frontend architecture

[Architecture index](README.md) · [Wiki home](../README.md)

## Framework

React 19 runs through TanStack Start and file-based routing. `src/router.tsx` connects React Query to Convex and wraps the generated route tree in `ConvexProvider`. Route files may render on the server, so browser APIs remain in handlers or client-safe initialization. `src/routeTree.gen.ts` and `convex/_generated/` are generated boundaries.

## Routes and data

| Route           | Feature module                              | Main reads/writes                                                              |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| `/`             | `features/roster/RosterApp.tsx`             | Season dashboard, player profiles/comparison, grade summaries, NFL alumni      |
| `/games`        | `features/landscape/LandscapeDashboard.tsx` | Weekly Power/games, merit dashboard, program profile, matchup, playoff, ballot |
| `/admin/roster` | `features/roster/RosterAdmin.tsx`           | Owner session, Michigan roster/games/health plus transactional owner mutations |

The public roster uses annual Player Seasons rather than inferring a current roster from a single stint. It exposes Roster, Rooms, Scholarships, Eligibility, Development, Grades, Compare, and NFL views. Profiles join commitments, stints, evaluations, movements, draft outcomes, Player Games, phase summaries, and NFL history. Comparison selection is capped at four.

The landscape workspace exposes Games, Power, Résumé, Playoff, Teams, Simulator, and Blind Ballot. It keeps predictive Power separate from earned Résumé evidence. The schedule displays edition-specific quadrants and strength; matchup scenarios label venue and user adjustment separately. Draft ballots omit identifying team fields, autosave insertion moves, and reveal comparisons only after submission.

The owner route exchanges the configured password for a revocable 12-hour token stored in local storage. Every query/mutation still verifies the token server-side. UI hiding is never authorization. Material operations show previews and remain disabled without a backup manifest.

## Presentation system

`components/AppShell.tsx` owns the shared Michigan-first shell, responsive navigation, page framing, metrics, tabs, and empty states. Tailwind CSS 4 provides styling. Michigan blue and maize establish hierarchy; serif display headings, dense data blocks, flat borders, and explicit state colors support a football-research workspace rather than a generic dashboard.

Controls are semantic, keyboard reachable, visibly focused, and sized for touch. Tabs collapse into usable narrow layouts, dense tables become stacked rows where needed, and every query surface accounts for loading, error, empty, unavailable, or stale data. No visual treatment changes domain null semantics.

## Data-access rules

- Use generated `api` references through `convexQuery`, `useMutation`, or direct `useConvex` calls for paginated operations.
- Keep source/provider shapes behind Convex; UI components consume normalized contracts.
- Include all query inputs in cache keys by using generated Convex query options.
- Do not turn missing data into zero, “unranked” into last place, or an unknown snap count into no participation.
- Keep destructive confirmation, dry-run output, backup identity, and mutation result visible near the action.

## Changing the UI

Add URL-addressable pages under `src/routes/`; keep domain orchestration in the owning feature. Reuse the shell/tokens before adding dependencies. Run `npm run check`, inspect narrow and wide layouts, exercise keyboard focus, and update [Current contracts](../reference/current-contracts.md).
