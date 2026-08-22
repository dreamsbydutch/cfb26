# Local development

[Guides index](README.md) · [Wiki home](../README.md)

## Prerequisites

- Node.js 22.12 or newer.
- npm (the lockfile is authoritative).
- Access to the intended Convex deployment for live data/backend work.
- Git for change review and collaboration.

The recorded `dreamsbydutch:michigan` deployments currently have a [source-alignment blocker](deployment.md#source-alignment-blocker). Use the web-only development command below; do not run Convex synchronization against those environments yet.

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

After the source-alignment blocker is resolved, `npm run dev` can restore the combined workflow. It runs `convex dev --start 'vite dev'`, which may synchronize backend functions, generate typed files, and then start Vite.

## Working with an existing deployment

A compatible deployment URL is enough for the web client to connect. Backend edits also require the Convex CLI to be authenticated and linked to that deployment. For the recorded football deployments, do not run a push until the remaining source-parity blocker is resolved and the operation is authorized.

Convex commonly writes local deployment metadata such as `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` to `.env.local`. That file is ignored and must stay untracked.

## Daily loop

1. Read the relevant wiki page and inspect nearby code.
2. Run `git status --short` before editing so existing work is visible.
3. Make the smallest coherent source change.
4. Run `npm run typecheck` for fast feedback.
5. Visually exercise changed routes and data states.
6. Update docs when contracts, behavior, commands, or structure changed.
7. Run `npm run check` before handoff.

After source alignment, a backend change with a linked deployment also requires:

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

If the roster fails to load, confirm the development deployment is reachable. If overriding it, confirm `.env.local` contains a compatible `VITE_CONVEX_URL` and restart the process; production currently has no public functions.

### Convex prompts to create a project

Stop and confirm the intended existing deployment. Creating a new deployment changes external state and can split data/configuration across projects.

### Vite reports an unsupported Node version

Upgrade to Node 22.12+ (or a compatible newer LTS) and reinstall dependencies. Vite 8 and the installed TanStack Start packages require that baseline.

### Windows Rolldown native binding error

Run `npm install` from the repository root. The Windows x64 Rolldown binding is an explicit dev dependency because npm may omit the optional platform package.

### Types disagree after backend edits

Do not patch `_generated`. While the recorded deployment blocker remains, stop and reconcile the source instead of pushing. After alignment, run `npx convex dev --once` against the intended deployment, then rerun `npm run typecheck`.
