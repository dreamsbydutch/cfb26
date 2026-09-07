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

| Variable            | Required where                       | Secret?       | Purpose                                                                                                        |
| ------------------- | ------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------- |
| `VITE_CONVEX_URL`   | Optional browser override            | No            | Compatible public URL used to create `ConvexQueryClient`; development is the checked-in fallback.              |
| `CONVEX_DEPLOYMENT` | Local Convex CLI when configured     | No, but local | Identifies the selected deployment to tooling.                                                                 |
| `CONVEX_DEPLOY_KEY` | Hosted production build/deploy       | Yes           | Authorizes deployment to the selected Convex project.                                                          |
| `CFBD_API_KEY`      | Convex football-data synchronization | Yes           | Authorizes CollegeFootballData games, Elo, ratings, advanced stats, talent, and returning-production requests. |
| `CFB26_ADMIN_KEY`   | Convex owner administration          | Yes           | Password exchanged for a revocable 12-hour owner session; minimum 24 characters and distinct per deployment.   |

No local environment file is required for public reads. A browser override belongs in `.env.local` or provider-managed environment settings. `CFBD_API_KEY` and `CFB26_ADMIN_KEY` belong only in the target Convex deployment environment; never place either in a tracked file or a `VITE_*` variable. Configure the admin key without putting it in shell history:

```powershell
npx convex env set CFB26_ADMIN_KEY
npx convex dev --once
```

The first command prompts for the value; the second pushes the checked-in functions and activates the changed typed environment. Confirm the selected development deployment first. When the variable is absent or shorter than 24 characters, owner login fails closed.

The known deployment URLs are recorded in [Deployment](../guides/deployment.md). Confirm the intended environment before running any command that synchronizes schema, functions, or data.

## Package scripts

| Script                                                   | Expansion                       | Notes                                                                                            |
| -------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`                                            | `convex dev --start "vite dev"` | Requires/establishes Convex CLI configuration, then serves Vite.                                 |
| `npm run dev:web`                                        | `vite dev`                      | Starts the browser app without pushing Convex code.                                              |
| `npm run typecheck`                                      | `tsc --noEmit`                  | Checks root includes: `src`, `convex`, and Vite config.                                          |
| `npm run lint`                                           | typecheck, then ESLint          | Uses TanStack and Convex recommended rules.                                                      |
| `npm run build`                                          | typecheck, then `vite build`    | Produces client and SSR/server bundles.                                                          |
| `npm run start`                                          | `vite preview`                  | Previews a prebuilt app locally; runtime environment must be present.                            |
| `npm run docs:check`                                     | local Node link checker         | Scans maintained Markdown and ignores generated/vendor/build trees.                              |
| `npm test`                                               | Node test runner                | Runs all offline behavior tests; network access and secrets are not required.                    |
| `npm run test:cfbd`                                      | Node test runner                | Runs the CFBD client, season-audit, and health-probe tests only.                                 |
| `npm run cfbd:probe -- '<json>'`                         | `convex run cfbdHealth:probe`   | Calls the deployed internal canary; requires a selected deployment and CFBD key.                 |
| `npm run migration:plan -- <legacy.json>`                | no-write migration audit        | Reports preserved people/seasons/draft, intentional PFF deletion, and unresolved identities.     |
| `npm run migration:prepare -- <legacy.json> <directory>` | migration preparation           | Writes non-overwriting target JSONL and a fingerprinted audit report without touching Convex.    |
| `npm run restore:prepare -- <backup.json> <directory>`   | restore preparation             | Verifies a v2 or revision-bound v3 fingerprint and writes ordered JSONL without touching Convex. |
| `npm run preview:find -- <owner/repo> <sha>`             | GitHub deployment lookup        | Resolves the direct Vercel preview URL for an exact commit SHA.                                  |
| `npm run check`                                          | tests, lint, docs, Vite build   | Standard full local gate.                                                                        |
| `npm run format`                                         | `prettier --write .`            | Mutates files; inspect the resulting diff.                                                       |

## Core dependencies

| Concern                   | Packages                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------- |
| UI/runtime                | `react`, `react-dom`, `lucide-react`, `fuse.js`, bundled Inter/Barlow font packages     |
| Full-stack routing        | `@tanstack/react-start`, `@tanstack/react-router`                                       |
| Query/cache bridge        | `@tanstack/react-query`, `@tanstack/react-router-with-query`, `@convex-dev/react-query` |
| Convex migrations         | `@convex-dev/migrations`                                                                |
| Backend/client            | `convex`                                                                                |
| Styling/build             | `tailwindcss`, `@tailwindcss/vite`, `vite`, `nitro`, `@vitejs/plugin-react`             |
| Type/lint/format          | TypeScript 6/7 aliases, TanStack ESLint config, Convex ESLint plugin, Prettier          |
| Windows build reliability | `@rolldown/binding-win32-x64-msvc`                                                      |

No identity-provider, component-system, third-party test framework, analytics, or state-management package beyond React Query is installed. Offline tests use Node's built-in test runner. The owner boundary uses the deployment-secret decision in [ADR 0005](../decisions/0005-single-owner-roster-admin-key.md), exchanging the secret for a stored, revocable token hash rather than retaining the password in browser state.

## Build configuration

- `vite.config.ts` installs Tailwind, TypeScript path resolution, TanStack Start, Nitro, and React plugins; dev port is 3000.
- `tsconfig.json` enables strict checks, bundler resolution, isolated modules, and the `~/* -> ./src/*` path alias.
- `convex/tsconfig.json` enables the same explicit `.ts` imports required by the native Node test runner so Convex deployment typechecking and offline tests validate one source form.
- `eslint.config.mjs` combines TanStack and Convex recommended configurations and ignores generated Convex and Nitro output.
- `.prettierrc` disables semicolons, uses single quotes, and keeps trailing commas.
- `vercel.json` selects the `tanstack-start` framework preset, deploys Convex, and runs the Nitro-backed web build as one hosted build command.

## Configuration gaps

CI is checked in under `.github/workflows/ci.yml`. There is no browser test runner, error-reporting provider, analytics provider, or tracked hosting project/team ID metadata. The recorded Vercel production domain and new backend contract still require an authorized deployment smoke check. Add configuration only for a demonstrated need.
