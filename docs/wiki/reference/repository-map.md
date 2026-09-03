# Repository map

[Reference index](README.md) · [Wiki home](../README.md)

## Top level

| Path                | Maintained role                                                                            | Change rule                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `.agents/skills/`   | Repository-specific skill instructions and trigger metadata.                               | One narrow workflow per folder; validate substantial skill edits.             |
| `convex/`           | Convex schema, functions, and generated client/server contract.                            | Author outside `_generated`; regenerate outputs.                              |
| `docs/wiki/`        | Detailed source of product, architecture, guide, operations, reference, and ADR knowledge. | Update with behavior/contracts; maintain section indexes.                     |
| `public/`           | Root-served icons and web manifest.                                                        | Use stable filenames referenced by root metadata.                             |
| `scripts/`          | Dependency-free deterministic repository helpers.                                          | Keep scripts cross-platform where practical and document package entrypoints. |
| `SnapCounts.json`   | Raw 2015–2025 Michigan season participation and PFF-grade source.                          | Preserve source values; transform through the checked-in preparation script.  |
| `src/`              | React application, routes, providers, and styles.                                          | Keep browser/server boundaries compatible with TanStack Start.                |
| `tests/`            | Offline behavior tests and sanitized CFBD fixtures.                                        | Test stable public seams; never store keys or live private data.              |
| `.env.example`      | Public environment-variable template.                                                      | Place names/placeholders only; never secrets.                                 |
| `.gitignore`        | Local/build/secret exclusions.                                                             | Keep local environment and generated build output untracked.                  |
| `.prettierignore`   | Generated/vendor exclusions from formatting.                                               | Add paths only when formatting is generated or externally owned.              |
| `.prettierrc`       | Semicolon-free, single-quote, trailing-comma style.                                        | Treat as repository-wide formatting policy.                                   |
| `AGENTS.md`         | Canonical concise repository instructions.                                                 | Keep operational and link to wiki detail.                                     |
| `CLAUDE.md`         | Compatibility pointer to `AGENTS.md`.                                                      | Do not duplicate instructions.                                                |
| `README.md`         | Human entry point and setup.                                                               | Keep short; link into wiki.                                                   |
| `eslint.config.mjs` | TanStack and Convex lint configuration.                                                    | Ignore generated Convex output only.                                          |
| `package.json`      | Commands and dependency boundaries.                                                        | Keep scripts documented and dependencies intentional.                         |
| `package-lock.json` | Reproducible npm dependency graph.                                                         | Update through npm, never hand-edit.                                          |
| `tsconfig.json`     | Strict root TypeScript project and `~/` alias.                                             | Keep includes limited to maintained source/config.                            |
| `vercel.json`       | Vercel build orchestration.                                                                | Keep deployment secrets outside the file.                                     |
| `vite.config.ts`    | Vite plugins and port.                                                                     | Preserve plugin responsibilities/order unless verified.                       |

## `src/`

| Path                          | Role                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/router.tsx`              | Creates TanStack Router, React Query, Convex client/provider, preload/cache policies, and fallback errors. |
| `src/routes/__root.tsx`       | HTML shell, title/viewport, global stylesheet, icons/manifest, route outlet, and framework scripts.        |
| `src/routes/index.tsx`        | `/` route definition, client-rendering policy, and route-level states.                                     |
| `src/routes/games.tsx`        | `/games` route definition, metadata, client-rendering policy, and route-level states.                      |
| `src/routes/admin.roster.tsx` | `/admin/roster` route definition, no-index metadata, and client-rendering policy.                          |
| `src/features/landscape/`     | Weekly importance, Power/Résumé ranking comparison, and the head-to-head matchup lab.                      |
| `src/features/roster/`        | Michigan data hydration, view switching, search, roster/season lists, and player details.                  |
| `src/routeTree.gen.ts`        | Generated file-route registry; do not edit.                                                                |
| `src/styles/app.css`          | Tailwind import and global base CSS.                                                                       |

## `convex/`

| Path                        | Role                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `convex/schema.ts`          | Declares the 21-table Michigan, national-data, legacy-rating, and immutable rating-edition model and indexes.              |
| `convex/players.ts`         | Player search and full-profile queries.                                                                                    |
| `convex/rosters.ts`         | Roster and movement-list queries.                                                                                          |
| `convex/rosterAdmin.ts`     | Server-key-protected mutations for player maintenance, complete active-roster arrivals, and history-preserving departures. |
| `convex/seasonalStats.ts`   | Season snap-count/PFF list query with zero-participation roster rows.                                                      |
| `convex/ratingInputs.ts`    | Independently synchronizes six optional CFBD rating/advanced-data sources.                                                 |
| `convex/ratingBacktest.ts`  | Defines leakage-safe folds, prediction metrics, logistic calibration, and model-promotion gates.                           |
| `convex/cfbdClient.ts`      | Validates authenticated CFBD endpoint responses and classifies retryable failures.                                         |
| `convex/cfbdAudit.ts`       | Reconciles one as-of-week games, box-score, and FBS-membership dataset.                                                    |
| `convex/cfbdHealth.ts`      | Exposes the internal read-only CFBD canary.                                                                                |
| `convex/cfbdHealthProbe.ts` | Runs the testable ten-endpoint canary orchestration.                                                                       |
| `convex/ratingModel.ts`     | Preserves the superseded percentile-composite formulas for migration fallback.                                             |
| `convex/ratingSystem.ts`    | Fits points-scale Power, wins-above-expectation Résumé, and calibrated matchup projections.                                |
| `convex/ratings.ts`         | Legacy sync plus immutable edition builds, publication selection, dashboard reads, and matchup queries.                    |
| `convex/tsconfig.json`      | Convex runtime TypeScript settings.                                                                                        |
| `convex/README.md`          | Local backend contract and maintenance rules.                                                                              |
| `convex/_generated/`        | Generated API/data-model/server types and Convex agent files.                                                              |

## `public/`

The folder currently contains favicon ICO/PNG variants, Apple touch icon, Android Chrome icons, and `site.webmanifest`. `src/routes/__root.tsx` links the favicon/touch/manifest files. These are starter brand assets and may be replaced together when branding is decided.

## Generated and ignored local paths

| Path                   | Producer                  | Commit?                  |
| ---------------------- | ------------------------- | ------------------------ |
| `node_modules/`        | `npm install`             | No                       |
| `.output/`             | Nitro production build    | No                       |
| `.nitro/`              | Nitro tooling cache       | No                       |
| `dist/`                | Legacy pre-Nitro builds   | No                       |
| `.tanstack/`           | TanStack tooling          | No                       |
| `.env`, `.env.local`   | Developer/Convex CLI      | No                       |
| `.vercel/`             | Vercel CLI                | No                       |
| `src/routeTree.gen.ts` | TanStack route generation | Yes, but never hand-edit |
| `convex/_generated/`   | Convex CLI                | Yes, but never hand-edit |

Use `rg --files -g '!node_modules' -g '!dist' -g '!.git'` for a current inventory.

## Repository skills

| Skill            | Trigger boundary                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `frontend-work`  | React routes, components, Tailwind, browser behavior, and accessibility.                              |
| `convex-work`    | Convex schema, functions, generated API use, data, and deployment attachment.                         |
| `maintain-docs`  | Agent guidance, wiki, runbooks, contracts, and ADRs.                                                  |
| `verify-changes` | Diff review and proportional quality gates; does not itself authorize writes.                         |
| `preview-pr`     | Explicitly authorized publication of a completed goal as a preview branch, Vercel deployment, and PR. |
