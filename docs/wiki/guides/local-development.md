# Local development

[Guides index](README.md) · [Wiki home](../README.md)

## Prerequisites

- Node.js 22.12 or newer.
- npm (the lockfile is authoritative).
- Access to the intended Convex deployment for live data/backend work.
- Git for change review and collaboration.

## First setup

From the repository root:

```powershell
npm install
Copy-Item .env.example .env.local
```

Set the public deployment URL in `.env.local`:

```dotenv
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

Then start the combined development process:

```powershell
npm run dev
```

The script runs `convex dev --start 'vite dev'`. The Convex CLI may prompt for login/project/deployment selection, synchronize backend functions, generate typed files, and then start Vite. Vite is configured for port 3000.

## Working with an existing deployment

A deployment URL is enough for the web client to connect. Backend edits also require the Convex CLI to be authenticated and linked to that deployment. Follow the CLI prompt rather than creating a new project when an existing deployment is intended.

Convex commonly writes local deployment metadata such as `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` to `.env.local`. That file is ignored and must stay untracked.

## Daily loop

1. Read the relevant wiki page and inspect nearby code.
2. Run `git status --short` before editing so existing work is visible.
3. Make the smallest coherent source change.
4. Run `npm run typecheck` for fast feedback.
5. Visually exercise changed routes and data states.
6. Update docs when contracts, behavior, commands, or structure changed.
7. Run `npm run check` before handoff.

For a backend change with a linked deployment, also run:

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

If startup reports a missing Convex URL, confirm `.env.local` contains a real `VITE_CONVEX_URL` and restart the process. The splash route does not query data, but router construction still initializes the Convex client.

### Convex prompts to create a project

Stop and confirm the intended existing deployment. Creating a new deployment changes external state and can split data/configuration across projects.

### Vite reports an unsupported Node version

Upgrade to Node 22.12+ (or a compatible newer LTS) and reinstall dependencies. Vite 8 and the installed TanStack Start packages require that baseline.

### Windows Rolldown native binding error

Run `npm install` from the repository root. The Windows x64 Rolldown binding is an explicit dev dependency because npm may omit the optional platform package.

### Types disagree after backend edits

Do not patch `_generated`. Run `npx convex dev --once` against the intended deployment, then rerun `npm run typecheck`.
