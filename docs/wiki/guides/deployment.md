# Deployment

[Guides index](README.md) · [Wiki home](../README.md)

## Current deployment model

**Current:** the repository is prepared for Vercel and Convex but does not record an attached Vercel project, production URL, or selected Convex deployment.

`vercel.json` configures this build command:

```text
npx convex deploy --cmd 'npm run build'
```

This sequence deploys the backend associated with the supplied Convex credentials and then builds the TanStack Start app against that deployment.

## Attach local development to Convex

1. Obtain the exact Convex deployment URL and confirm which project/deployment it represents.
2. Put the URL in untracked `.env.local` as `VITE_CONVEX_URL`.
3. Run `npm run dev` and authenticate the Convex CLI if prompted.
4. Select the existing project/deployment; do not create another deployment unless requested.
5. Visit `/anotherPage`, confirm the query loads, invoke the sample action, and confirm the number list updates.

A URL connects the browser. CLI authentication/deployment selection is additionally required to push schema and function changes.

## Configure a Vercel project

The production project must provide the Convex deployment credential expected by `npx convex deploy` (normally a `CONVEX_DEPLOY_KEY`) as a protected environment value. Confirm that the web build receives the matching public `VITE_CONVEX_URL`; the Convex deployment command can coordinate this value for its child build.

Never place deploy keys in `.env.example`, `vercel.json`, GitHub, client code, or a `VITE_*` variable.

## Release procedure

1. Confirm the target Git commit, Convex deployment, and Vercel project/environment.
2. Run `npm run check` locally.
3. If backend code changed, run `npx convex dev --once` against the intended non-production environment first.
4. Review the diff and confirm no secrets/local environment files are tracked.
5. Commit and push only when authorized.
6. Trigger or observe the Vercel build.
7. Verify the Convex deploy step and both client/server build bundles.
8. Smoke-test `/` and `/anotherPage` (or their product replacements) against production.
9. Record the production URL and ownership here once a project is attached.

## Failure and rollback

- If Convex deployment fails, the web build should not be treated as releasable. Fix the schema/function/configuration error and rerun the same commit.
- If the web build fails after Convex deploy, determine whether the backend change is backward compatible before retrying or rolling back.
- Roll back by deploying a known-good commit through the same pipeline; do not manually edit generated files or production data as a substitute.
- Data migrations require their own forward/rollback plan before execution. No migration framework exists today.

## Deployment record

| Item                      | Value                              |
| ------------------------- | ---------------------------------- |
| GitHub repository         | `dreamsbydutch/cfb26`              |
| Default branch            | `main`                             |
| Convex project/deployment | **Undecided / not stored in repo** |
| Vercel project            | **Undecided / not stored in repo** |
| Production URL            | **Undecided**                      |
