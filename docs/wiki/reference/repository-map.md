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
| `.github/`          | Read-only CI workflow for the full repository check.                                       | Keep permissions minimal and secrets out of workflow source.                  |
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

| Path                        | Role                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/router.tsx`            | Creates TanStack Router, React Query, Convex client/provider, preload/cache policies, and fallback errors. |
| `src/routes/__root.tsx`     | HTML shell, title/viewport, global stylesheet, icons/manifest, route outlet, and framework scripts.        |
| `src/routes/index.tsx`      | Canonical `/` Michigan Matrix route definition and route-level states.                                     |
| `src/routes/michigan.*.tsx` | Michigan Overview, Movement, Alumni, player, comparison, and Matrix redirect routes.                       |
| `src/routes/games.tsx`      | Canonical `/games` National Games route definition and states.                                             |
| `src/routes/national.*.tsx` | Power, Résumé, Playoff, Teams/program, Simulator, Ballot, Methodology, and Games redirect routes.          |
| `src/routes/admin.roster*`  | Desktop Owner Dashboard, Roster/player, Season, Data, and Operations routes with no-index metadata.        |
| `src/components/`           | Shared public context shell, fuzzy search, responsive navigation, metrics, surfaces, and states.           |
| `src/features/michigan/`    | Matrix, Overview/readiness, Movement, player intelligence, comparison, and alumni.                         |
| `src/features/landscape/`   | Games, Power, Résumé/SOS, playoff, team profiles, simulator, ballot, and methodology.                      |
| `src/features/roster/`      | Shared Michigan reads and private owner workflows.                                                         |
| `src/routeTree.gen.ts`      | Generated file-route registry; do not edit.                                                                |
| `src/styles/app.css`        | Tailwind import and global base CSS.                                                                       |

## `convex/`

| Path                        | Role                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `convex/schema.ts`          | Declares the 43-table Michigan, national, derived-output, NFL, revision, and audit model with 104 indexes.                |
| `convex/playerDomain.ts`    | Pure position-room, player-game, grade-band, phase-summary, and all-phase overall-grade invariants.                       |
| `convex/players.ts`         | Fuzzy-search catalog source, player profile/overall grade, comparison, and Michigan-alumni NFL reads.                     |
| `convex/rosters.ts`         | Season dashboard, roster, scholarship/eligibility, returning-production, and movement reads.                              |
| `convex/rosterAdmin.ts`     | Session-protected lifecycle, batch season, NFL-gap, import, revisioned backup, audit, identity, repair, and health flows. |
| `convex/migrations.ts`      | Stateful manifest-retirement migration for the Michigan revision cutover.                                                 |
| `convex/seasonalStats.ts`   | Michigan Player Game writes/imports and public phase-grade summaries.                                                     |
| `convex/nflverse.ts`        | Pure nflverse CSV parsing, status normalization, and conventional-stat extraction.                                        |
| `convex/migrationV2.ts`     | Pure legacy audit and target-document preparation with explicit PFF deletion.                                             |
| `convex/ratingInputs.ts`    | Independently synchronizes six optional CFBD rating/advanced-data sources.                                                |
| `convex/ratingBacktest.ts`  | Defines leakage-safe folds, prediction metrics, logistic calibration, and model-promotion gates.                          |
| `convex/cfbdClient.ts`      | Validates authenticated CFBD endpoint responses and classifies retryable failures.                                        |
| `convex/cfbdAudit.ts`       | Reconciles one as-of-week games, box-score, and FBS-membership dataset.                                                   |
| `convex/cfbdHealth.ts`      | Exposes the internal read-only CFBD canary.                                                                               |
| `convex/cfbdHealthProbe.ts` | Runs the testable ten-endpoint canary orchestration.                                                                      |
| `convex/ratingModel.ts`     | Preserves the superseded percentile-composite formulas for migration fallback.                                            |
| `convex/ratingSystem.ts`    | Fits points-scale Power, wins-above-expectation Résumé, and calibrated matchup projections.                               |
| `convex/ratings.ts`         | Immutable edition builds, forecasts, Power/Résumé reads, schedule/quadrants, playoff projections, and ballots.            |
| `convex/tsconfig.json`      | Convex runtime TypeScript settings.                                                                                       |
| `convex/README.md`          | Local backend contract and maintenance rules.                                                                             |
| `convex/_generated/`        | Generated API/data-model/server types and Convex agent files.                                                             |

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
