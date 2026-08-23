# Deployment

[Guides index](README.md) · [Wiki home](../README.md)

## Current deployment model

**Current:** the repository records the `dreamsbydutch:michigan` Convex development and production deployments below. The owner identified the attached Vercel project as `cfb` and its production domain as `https://cfb-hazel.vercel.app`; the domain returned Vercel `NOT_FOUND` before the Nitro deployment configuration was added and still requires a new production deployment and smoke check.

`vite.config.ts` registers Nitro after TanStack Start so a production build emits `.output/public` and `.output/server`. `vercel.json` selects the `tanstack-start` framework preset and configures this build command:

```text
npx convex deploy --cmd 'npm run build'
```

This sequence deploys the backend associated with the supplied Convex credentials and then builds the TanStack Start app against that deployment.

### Source alignment

**Resolved 2026-08-22:** the checked-in nine-table schema and five public reads were push-validated in development and deployed to production. The owner authorized retiring the unrecovered internal legacy-import functions. Both environments were then populated with the same 921 seasonal rows and verified at 4,005 documents.

Later backend changes still follow development-first validation. A URL alone is not permission to overwrite backend configuration; confirm the exact environment and operation before synchronization.

### Seasonal-data refresh

`SnapCounts.json` is the tracked source for the hosted `seasonalPlayerStats` table. To refresh it, roll out one environment at a time:

1. Export all target `players` and `programs` documents as JSON arrays into ignored `.tmp/players.json` and `.tmp/programs.json` files.
2. Run `npm run data:prepare-snaps -- .tmp/players.json .tmp/programs.json`.
3. Confirm the preparation report says 921 rows and review its linked/source-only counts for that target.
4. Push the schema and functions to development with `npx convex dev --once`; deploy production only after development verification.
5. Import `.tmp/seasonal-player-stats.json` into `seasonalPlayerStats` with `npx convex import --table seasonalPlayerStats --replace .tmp/seasonal-player-stats.json` against the same explicit deployment.
6. Verify 921 table rows, all 11 season counts, `seasonalStats.listBySeason`, linked player profiles, and source-only names before considering another environment.

`--replace` is intentional because the preparation output is a complete deterministic table snapshot. Never reuse a generated file across deployments unless their player/program IDs were verified identical immediately before import.

## Attach local development to Convex

1. Obtain the exact Convex deployment URL and confirm which project/deployment it represents.
2. Put the URL in untracked `.env.local` as `VITE_CONVEX_URL` when overriding the development fallback.
3. Run `npm run dev:web` for web-only work or `npm run dev` when authenticated development synchronization is intended.
4. Visit `/`, confirm 428 players and 109 recorded NFL entries load, exercise every view, search, and a player profile.

A URL connects the browser. CLI authentication/deployment selection is additionally required to push schema and function changes.

## Configure a Vercel project

The production project must provide the Convex deployment credential expected by `npx convex deploy` (normally a `CONVEX_DEPLOY_KEY`) as a protected environment value. Confirm that the web build receives the matching public `VITE_CONVEX_URL`; the Convex deployment command can coordinate this value for its child build.

Never place deploy keys in `.env.example`, `vercel.json`, GitHub, client code, or a `VITE_*` variable.

## Preview deployments

The [`$preview-pr` workflow](preview-pull-request.md) publishes completed agent work on a new `preview/*` branch. The Vercel GitHub integration is expected to build the pushed commit and report a GitHub deployment with a direct `environment_url`. The workflow binds the PR to that exact SHA, smoke-tests the URL, and keeps the PR draft if deployment cannot be proven.

Preview publishing does not authorize or trigger a production promotion. If the Vercel project is configured to deploy only after a PR event, the workflow uses a single draft PR as the trigger and marks it ready only after success.

## Release procedure

1. Confirm the target Git commit, Convex deployment, and Vercel project/environment.
2. Run `npm run check` locally.
3. If backend code changed, run `npx convex dev --once` against the intended non-production environment first.
4. Review the diff and confirm no secrets/local environment files are tracked.
5. Commit and push only when authorized.
6. Trigger or observe the Vercel build.
7. Verify the Convex deploy step and both client/server build bundles.
8. Smoke-test `/`, all six roster views, search, a linked player profile, a zero-snap season row, and a source-only season row against production.
9. Record the production URL and ownership here once a project is attached.

## Failure and rollback

- If Convex deployment fails, the web build should not be treated as releasable. Fix the schema/function/configuration error and rerun the same commit.
- If the web build fails after Convex deploy, determine whether the backend change is backward compatible before retrying or rolling back.
- Roll back by deploying a known-good commit through the same pipeline; do not manually edit generated files or production data as a substitute.
- Data migrations require their own forward/rollback plan before execution. No migration framework exists today.

## Deployment record

| Item                     | Value                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| GitHub repository        | `dreamsbydutch/cfb26`                                                                           |
| Default branch           | `main`                                                                                          |
| Convex project           | `dreamsbydutch:michigan`                                                                        |
| Development deployment   | `https://adjoining-opossum-710.convex.cloud`                                                    |
| Production deployment    | `https://doting-chipmunk-7.convex.cloud`                                                        |
| Production data mirror   | 2026-08-22; 9 tables and 4,005 documents, live-verified identical to development                |
| Seasonal data extension  | 921 rows: 708 linked to canonical players and 213 preserved as source-only records              |
| Backend source alignment | **Current:** five public reads deployed in both environments; obsolete internal imports retired |
| Vercel project           | `cfb` (owner-confirmed; Vercel project/team IDs remain untracked)                               |
| Production URL           | `https://cfb-hazel.vercel.app` (owner-confirmed; Nitro redeploy and smoke check pending)        |
