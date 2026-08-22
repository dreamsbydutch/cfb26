# Local development

[Guides index](README.md) · [Wiki home](../README.md)

## Prerequisites

- Node.js 22.12 or newer.
- npm (the lockfile is authoritative).
- Access to the intended Convex deployment for live data/backend work.
- Git for change review and collaboration.

The recorded `dreamsbydutch:michigan` deployments match the checked-in Convex contract. Confirm the intended target before synchronizing backend source or data.

## First setup

From the repository root:

```powershell
npm install
```

The app defaults to the public Michigan development deployment. To use another compatible deployment, create `.env.local` and set:

```dotenv
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

Then start the web application without pushing backend code:

```powershell
npm run dev:web
```

The script runs `vite dev` on port 3000. `/` reads the Michigan development deployment without pushing backend code.

For backend work, `npm run dev` runs `convex dev --start 'vite dev'`, synchronizes the configured development functions, regenerates typed files, and starts Vite.

## Working with an existing deployment

A compatible deployment URL is enough for the web client to connect. Backend edits also require the Convex CLI to be authenticated and linked to that deployment. Always verify the configured target before a push.

Convex commonly writes local deployment metadata such as `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` to `.env.local`. That file is ignored and must stay untracked.

## Daily loop

1. Read the relevant wiki page and inspect nearby code.
2. Run `git status --short` before editing so existing work is visible.
3. Make the smallest coherent source change.
4. Run `npm run typecheck` for fast feedback.
5. Visually exercise changed routes and data states.
6. Update docs when contracts, behavior, commands, or structure changed.
7. Run `npm run check` before handoff.

A backend change with a linked deployment also requires:

```powershell
npx convex dev --once
```

## Generated files

- `src/routeTree.gen.ts` is generated from `src/routes/`.
- `convex/_generated/` is generated from Convex schema/functions.
- `dist/` and `.tanstack/` are local build/tool outputs.

Do not hand-edit generated files. Inspect their diffs when they are tracked, and regenerate from source.

## Troubleshooting

### Missing Convex URL

If the roster fails to load, confirm the selected deployment is reachable. If overriding it, confirm `.env.local` contains a compatible `VITE_CONVEX_URL` and restart the process. Both recorded deployments expose the public functions.

### Convex prompts to create a project

Stop and confirm the intended existing deployment. Creating a new deployment changes external state and can split data/configuration across projects.

### Vite reports an unsupported Node version

Upgrade to Node 22.12+ (or a compatible newer LTS) and reinstall dependencies. Vite 8 and the installed TanStack Start packages require that baseline.

### Windows Rolldown native binding error

Run `npm install` from the repository root. The Windows x64 Rolldown binding is an explicit dev dependency because npm may omit the optional platform package.

### Types disagree after backend edits

Do not patch `_generated`. Run `npx convex dev --once` against the intended development deployment, then rerun `npm run typecheck`.
