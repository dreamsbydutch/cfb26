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
| `src/`              | React application, routes, providers, and styles.                                          | Keep browser/server boundaries compatible with TanStack Start.                |
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

| Path                         | Role                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/router.tsx`             | Creates TanStack Router, React Query, Convex client/provider, preload/cache policies, and fallback errors. |
| `src/routes/__root.tsx`      | HTML shell, title/viewport, global stylesheet, icons/manifest, route outlet, and framework scripts.        |
| `src/routes/index.tsx`       | `/` splash page.                                                                                           |
| `src/routes/anotherPage.tsx` | `/anotherPage` Convex query/action demonstration.                                                          |
| `src/routeTree.gen.ts`       | Generated file-route registry; do not edit.                                                                |
| `src/styles/app.css`         | Tailwind import and global base CSS.                                                                       |

## `convex/`

| Path                    | Role                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `convex/schema.ts`      | Declares the sample `numbers` table.                          |
| `convex/myFunctions.ts` | Declares current sample query, mutation, and action.          |
| `convex/tsconfig.json`  | Convex runtime TypeScript settings.                           |
| `convex/README.md`      | Local backend contract and maintenance rules.                 |
| `convex/_generated/`    | Generated API/data-model/server types and Convex agent files. |

## `public/`

The folder currently contains favicon ICO/PNG variants, Apple touch icon, Android Chrome icons, and `site.webmanifest`. `src/routes/__root.tsx` links the favicon/touch/manifest files. These are starter brand assets and may be replaced together when branding is decided.

## Generated and ignored local paths

| Path                   | Producer                  | Commit?                  |
| ---------------------- | ------------------------- | ------------------------ |
| `node_modules/`        | `npm install`             | No                       |
| `dist/`                | `npm run build`           | No                       |
| `.tanstack/`           | TanStack tooling          | No                       |
| `.env`, `.env.local`   | Developer/Convex CLI      | No                       |
| `.vercel/`             | Vercel CLI                | No                       |
| `src/routeTree.gen.ts` | TanStack route generation | Yes, but never hand-edit |
| `convex/_generated/`   | Convex CLI                | Yes, but never hand-edit |

Use `rg --files -g '!node_modules' -g '!dist' -g '!.git'` for a current inventory.
