# Frontend architecture

[Architecture index](README.md) · [Wiki home](../README.md)

## Framework

React 19 runs through TanStack Start and file-based routing. `src/router.tsx` connects React Query to Convex and wraps the generated route tree in `ConvexProvider`. Route files may render on the server, so browser APIs remain in handlers or client-safe initialization. `src/routeTree.gen.ts` and `convex/_generated/` are generated boundaries.

## Routes and data

| Route family                       | Feature module                              | Main reads/writes                                                                                       |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/`, `/michigan/*`                 | `features/michigan/MichiganWorkspace.tsx`   | Matrix, Overview, Movement, player intelligence, comparison, and NFL alumni                             |
| `/games`, `/national/*`            | `features/landscape/LandscapeDashboard.tsx` | Games, Program, Power, Résumé, Playoff, teams, matchup simulation, ballot, and methodology                       |
| `/admin/roster`, `/admin/roster/*` | `features/roster/RosterAdmin.tsx`           | Owner Dashboard, Roster, Player Stats, Data, Operations, session, health, revision, and audit workflows |

The public Michigan front door is the Roster Matrix. Overview, Movement, Alumni, player, and four-player comparison are canonical routes, while `/michigan/matrix` redirects to `/`. Matrix rooms run quarterbacks, backs, receivers, offensive line, defensive line, linebackers, secondary, then specialists; `OC` derives to offensive line. Starter, rotation, and reserve/unassigned lanes sort by starts, games, owner room order, and name. Overview publishes the hardcoded DbyD roster template, roster-limit-scaled readiness thresholds, and URL-backed Roster, Experience, Performance, and Lifecycle table presets. The superseded prototype switcher, Personnel Command, and old broad roster application are removed.

The National shell exposes canonical Games, Power, Résumé, Playoff, Teams, Simulator, Blind Ballot, and Methodology routes; `/national/games` redirects to `/games`. The compact schedule table groups games under prominent kickoff-slot rows and attaches rank from the same complete season-specific FBS field shown on Power. Power runs continuously through the field size with search/conference filtering and football rating components; diagnostic columns such as prior weight, evidence, and coverage are omitted. Team schedules show top-50 ranks from the selected edition. Matchup scenarios label the model baseline, venue, and user adjustment separately. Draft ballots omit identity until submission and autosave insertion moves.

The Owner shell exchanges the configured password for a revocable 12-hour token and is intentionally unavailable below 1024px except for session status/sign-out. Every query/mutation verifies the token server-side. Dashboard actions derive from live conditions. Roster opens to one searchable table where jersey, position, role, roster status, availability, games played, and starts are edited inline and saved together; lifecycle and extended annual fields remain available behind explicit advanced controls. Player Stats guides the owner from player to game, shows which games already have data, preloads saved values for updates, and uses ordinary name/value rows for conventional statistics. Data owns sources/imports/identity queue, while Operations isolates backup, rollover, rules, merge, and deletion. Consequential mutations produce receipts, advance Michigan data revision, and append audit events; destructive actions require a preview and current-revision backup.
The selected owner season persists across nested admin routes. Enrollment and decommitment controls are shown only when the selected person has a matching active commitment in that season, and those mutations use the season from the commitment record.

## Presentation system

Pages lead with their name, controls, and data. Repeated introductions, source plumbing, and routine how-it-works notes are omitted across National, Michigan, and the owner workspace. Rating methodology and coverage limits live on Methodology; concise empty/error states, data-entry semantics, and guidance for consequential actions stay next to their controls. Page headers and owner cards do not reserve space for absent descriptions.

`components/AppShell.tsx` owns the unified public context shell, keyboard search, responsive navigation, surfaces, status, metrics, and route states. Owner uses the same tokens in a distinct sidebar shell. Tailwind CSS 4, bundled Inter Variable and Barlow Condensed, Lucide icons, 10–24px radii, soft shadows, and reduced-motion support form the presentation system. Every workspace uses a white base: Michigan pairs navy structure with maize highlights, while National and Owner use graphite and grayscale accents. Michigan entries retain a maize-and-navy highlight wherever programs or matchups are listed nationally. Fuse.js powers the client-side typo-tolerant player/program catalog after the bounded catalog query loads.

Controls are semantic, keyboard reachable, visibly focused, and sized for touch. Public navigation becomes a bottom context bar on narrow screens; Matrix rooms collapse into accordions. The global search dialog is focus-contained and opens with Ctrl/Cmd-K. Every query surface accounts for loading, error, empty, unavailable, or stale data. No visual treatment changes domain null semantics.

## Data-access rules

- Use generated `api` references through `convexQuery`, `useMutation`, or direct `useConvex` calls for paginated operations.
- Keep source/provider shapes behind Convex; UI components consume normalized contracts.
- Include all query inputs in cache keys by using generated Convex query options.
- Do not turn missing data into zero, “unranked” into last place, or an unknown snap count into no participation.
- Keep destructive confirmation, dry-run output, backup identity, and mutation result visible near the action.

## Changing the UI

Add URL-addressable pages under `src/routes/`; keep domain orchestration in the owning feature. Reuse the shell/tokens before adding dependencies. Run `npm run check`, inspect narrow and wide layouts, exercise keyboard focus, and update [Current contracts](../reference/current-contracts.md).
