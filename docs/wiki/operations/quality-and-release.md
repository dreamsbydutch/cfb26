# Quality and release

[Operations index](README.md) · [Wiki home](../README.md)

## Current quality system

The repository has strict TypeScript, TanStack/Convex ESLint rules, Prettier, production builds, a local Markdown-link checker, and offline Node tests for the CFBD seams plus the rating backtest, calibration, and promotion contracts. It does **not** yet have broader query integration coverage, end-to-end, accessibility, performance, or CI automation.

Season participation adds focused `convex-test` integration coverage under Vitest's edge runtime: owner-session rejection, atomic import failure, revision/backup checks, replay behavior, other-phase preservation, annual edits, and rollover. `npm test` runs both the existing Node suite and the Convex specs; `npm run test:participation` runs just the screenshot validation and import integration checks. `vitest.config.ts` owns this test environment, and Convex specs use the `.spec.ts` suffix so Node's test discovery does not execute them.

Frontend `.spec.tsx` files also run in Vitest. The football roster rendering regression checks the actual position table's ordered tier sections, counts, snap order within tiers, and omission of empty tiers. Its dashboard hook is mocked so this check requires no deployment or database writes.

Do not describe typecheck/build output as “tests.” Name the check that actually ran.

## Commands and evidence

| Command                 | Evidence                                                                | When to run                              |
| ----------------------- | ----------------------------------------------------------------------- | ---------------------------------------- |
| `npm test`              | Offline automated behavior tests pass.                                  | Any tested backend/data-contract change. |
| `npm run test:cfbd`     | CFBD client, audit, and health-probe tests pass.                        | CFBD ingestion or validation changes.    |
| `npm run test:ratings`  | Leakage, forecast metrics, calibration, and promotion tests pass.       | Rating or matchup-projection changes.    |
| `npm run typecheck`     | TypeScript contracts compile without emission.                          | During TS/Convex work.                   |
| `npm run lint`          | Typecheck plus configured ESLint rules pass.                            | Any code change.                         |
| `npm run docs:check`    | Maintained Markdown has no broken local inline links.                   | Any documentation/structure change.      |
| `npm run build`         | Client and server production bundles are created.                       | Any runtime/config/dependency change.    |
| `npm run check`         | Tests, lint, documentation links, and production build all pass.        | Normal pre-handoff/release gate.         |
| `npx convex dev --once` | Backend validates, pushes, and regenerates against a linked deployment. | Convex schema/function changes.          |

## Manual checks

For user-facing changes, inspect at least:

- The affected URL at narrow and wide widths.
- Keyboard navigation and visible focus.
- Loading, empty, success, and error states when data-bound.
- Console/server output for new errors.
- Live Convex behavior when the feature reads or writes data.

The current smoke surface includes the Football / Basketball / Hockey sport switcher, one football player route, retired football-view redirects with a season, global search, and narrow/wide public layouts. National changes additionally require `/games`, `/national/power`, `/national/program`, pre-Week-7 `/national/resume`, one team profile, methodology metadata, and one simulator matchup at each venue mode. Owner changes require the sub-1024 boundary plus Dashboard, inline Roster/player editing, new and existing Player Stats entry, Data, and Operations at desktop width.

## Diff hygiene

Before handoff:

```powershell
git status --short
git diff --stat
git diff
git diff --cached
```

Confirm:

- `.env`, `.env.local`, deployment keys, tokens, and credentials are absent.
- `node_modules/`, `.output/`, `.nitro/`, `dist/`, `.tanstack/`, and tool caches are absent.
- Generated route/Convex diffs correspond to source changes and were not hand-edited.
- Lockfile changes have an intentional dependency change.
- Commands, contracts, and wiki pages match the resulting source.

## Commit and release policy

- Keep commits focused and describe the observable change.
- Do not rewrite or discard user changes to make a clean diff.
- Commit, push, open a pull request, deploy, or mutate an external service only when explicitly requested.
- Verify the exact branch/remote/target before publishing.
- After pushing, compare the remote branch commit with local `HEAD`.
- Validate Convex changes against development before promoting the same checked-in contract to production.
- When explicitly asked to publish completed work for review, use [`$preview-pr`](../../../.agents/skills/preview-pr/SKILL.md) so the branch, commits, Vercel deployment, and PR remain tied to one final SHA.

## Current gaps and next investments

Extend automated coverage to football query contracts and player grouping/filtering logic. Before public production, add CI for `npm ci` and `npm run check`, an end-to-end smoke test, accessible UI checks, and deployment smoke/rollback ownership.
