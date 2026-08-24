# Configuration and commands

[Reference index](README.md) · [Wiki home](../README.md)

## Runtime baseline

| Item                | Current value                           |
| ------------------- | --------------------------------------- |
| Package manager     | npm with `package-lock.json`            |
| Node.js             | 22.12+                                  |
| Module mode         | ESM (`"type": "module"`)                |
| TypeScript target   | ES2022 root; ESNext Convex runtime      |
| Dev server          | Vite on port 3000                       |
| Build output        | `.output/public` and `.output/server`   |
| Local build preview | Vite preview server (default port 4173) |

## Environment variables

| Variable            | Required where                       | Secret?       | Purpose                                                                                                                    |
| ------------------- | ------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `VITE_CONVEX_URL`   | Optional browser override            | No            | Compatible public URL used to create `ConvexQueryClient`; development is the checked-in fallback.                          |
| `CONVEX_DEPLOYMENT` | Local Convex CLI when configured     | No, but local | Identifies the selected deployment to tooling.                                                                             |
| `CONVEX_DEPLOY_KEY` | Hosted production build/deploy       | Yes           | Authorizes deployment to the selected Convex project.                                                                      |
| `CFBD_API_KEY`      | Convex football-data synchronization | Yes           | Authorizes CollegeFootballData games, Elo, ratings, advanced stats, talent, and returning-production requests.             |
| `CFB26_ADMIN_KEY`   | Convex roster administration         | Yes           | Enables the single-owner roster mutations installed in that deployment; minimum 24 characters and distinct per deployment. |

No local environment file is required for public reads. A browser override belongs in `.env.local` or provider-managed environment settings. `CFBD_API_KEY` and `CFB26_ADMIN_KEY` belong only in the target Convex deployment environment; never place either in a tracked file or a `VITE_*` variable. Configure the admin key without putting it in shell history:

```powershell
npx convex env set CFB26_ADMIN_KEY
npx convex dev --once
```

The first command prompts for the value; the second pushes the checked-in functions and activates the changed typed environment. Confirm the selected development deployment first. When the variable is absent or shorter than 24 characters, `/admin/roster` remains visible but every write is denied.

The known deployment URLs are recorded in [Deployment](../guides/deployment.md). Confirm the intended environment before running any command that synchronizes schema, functions, or data.

## Package scripts

| Script                                                         | Expansion                        | Notes                                                                                            |
| -------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`                                                  | `convex dev --start 'vite dev'`  | Requires/establishes Convex CLI configuration, then serves Vite.                                 |
| `npm run dev:web`                                              | `vite dev`                       | Starts the browser app without pushing Convex code.                                              |
| `npm run typecheck`                                            | `tsc --noEmit`                   | Checks root includes: `src`, `convex`, and Vite config.                                          |
| `npm run lint`                                                 | typecheck, then ESLint           | Uses TanStack and Convex recommended rules.                                                      |
| `npm run build`                                                | typecheck, then `vite build`     | Produces client and SSR/server bundles.                                                          |
| `npm run start`                                                | `vite preview`                   | Previews a prebuilt app locally; runtime environment must be present.                            |
| `npm run docs:check`                                           | local Node link checker          | Scans maintained Markdown and ignores generated/vendor/build trees.                              |
| `npm run data:prepare-snaps -- <players.json> <programs.json>` | seasonal-stat import preparation | Validates `SnapCounts.json`, links known players, and writes an ignored Convex JSON import file. |
| `npm run preview:find -- <owner/repo> <sha>`                   | GitHub deployment lookup         | Resolves the direct Vercel preview URL for an exact commit SHA.                                  |
| `npm run check`                                                | lint, docs links, Vite build     | Standard full local gate.                                                                        |
| `npm run format`                                               | `prettier --write .`             | Mutates files; inspect the resulting diff.                                                       |

## Core dependencies

| Concern                   | Packages                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------- |
| UI/runtime                | `react`, `react-dom`                                                                    |
| Full-stack routing        | `@tanstack/react-start`, `@tanstack/react-router`                                       |
| Query/cache bridge        | `@tanstack/react-query`, `@tanstack/react-router-with-query`, `@convex-dev/react-query` |
| Backend/client            | `convex`                                                                                |
| Styling/build             | `tailwindcss`, `@tailwindcss/vite`, `vite`, `nitro`, `@vitejs/plugin-react`             |
| Type/lint/format          | TypeScript 6/7 aliases, TanStack ESLint config, Convex ESLint plugin, Prettier          |
| Windows build reliability | `@rolldown/binding-win32-x64-msvc`                                                      |

No identity-provider, component-system, testing, analytics, or state-management package beyond React Query is installed. The roster editor uses the deployment-secret decision in [ADR 0005](../decisions/0005-single-owner-roster-admin-key.md), not an authentication package.

## Build configuration

- `vite.config.ts` installs Tailwind, TypeScript path resolution, TanStack Start, Nitro, and React plugins; dev port is 3000.
- `tsconfig.json` enables strict checks, bundler resolution, isolated modules, and the `~/* -> ./src/*` path alias.
- `eslint.config.mjs` combines TanStack and Convex recommended configurations and ignores generated Convex and Nitro output.
- `.prettierrc` disables semicolons, uses single quotes, and keeps trailing commas.
- `vercel.json` selects the `tanstack-start` framework preset, deploys Convex, and runs the Nitro-backed web build as one hosted build command.

## Configuration gaps

There is no checked-in CI workflow, test runner, environment schema validator, error-reporting provider, analytics provider, or hosting project/team ID metadata. The recorded Vercel production domain still requires a Nitro-backed redeploy and smoke check. Add and document new configuration only when a real requirement exists.
