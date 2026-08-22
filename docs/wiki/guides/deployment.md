# Deployment

[Guides index](README.md) · [Wiki home](../README.md)

## Current deployment model

**Current:** the repository records the `dreamsbydutch:michigan` Convex development and production deployments below. It does not record an attached Vercel project or production web URL.

`vercel.json` configures this build command:

```text
npx convex deploy --cmd 'npm run build'
```

This sequence deploys the backend associated with the supplied Convex credentials and then builds the TanStack Start app against that deployment.

### Source-alignment blocker

The checked-in backend now represents the hosted eight-table football schema and reimplements the four public development read functions. Production was intentionally seeded from development schema/data on 2026-08-18 but still has no functions. Development also contains internal legacy-import functions that have not been recovered.

Do not run `npm run dev`, `npx convex dev`, `npx convex deploy`, or a Vercel build against these deployments until schema/public-function parity is reviewed, the internal-function difference is resolved, and a development push is explicitly authorized. A URL alone is not permission to overwrite backend configuration.

## Attach local development to Convex

This workflow is blocked for the recorded deployments until the source-alignment blocker above is resolved.

1. Obtain the exact Convex deployment URL and confirm which project/deployment it represents.
2. Put the URL in untracked `.env.local` as `VITE_CONVEX_URL` when overriding the development fallback.
3. Run `npm run dev:web` so no backend push occurs.
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
8. Smoke-test `/`, all five roster views, search, and a player profile against production.
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
| Production data mirror   | 2026-08-22; 8 tables and 3,084 documents, live-verified identical to development                |
| Backend source alignment | **Blocked:** schema/public reads are represented; internal functions and push validation remain |
| Vercel project           | **Undecided / not stored in repo**                                                              |
| Production URL           | **Undecided**                                                                                   |
