# Quality and release

[Operations index](README.md) · [Wiki home](../README.md)

## Current quality system

The repository has strict TypeScript, TanStack/Convex ESLint rules, Prettier, production builds, a local Markdown-link checker, and offline Node tests for the CFBD seams plus the rating backtest, calibration, and promotion contracts. It does **not** yet have broader query integration coverage, end-to-end, accessibility, performance, or CI automation.

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

The current smoke surface includes `/`: all six roster views, search, one player drawer, and narrow/wide layouts. Rating changes additionally require `/games` at narrow and wide widths, pre-Week-7 Power-only behavior, post-Week-7 Power/Résumé comparison, edition metadata, and one matchup at each venue mode.

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
