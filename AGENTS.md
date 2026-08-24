# Agent guide

This is the canonical operating guide for agents working in `cfb26`. Keep it short and actionable. Put durable explanations in the [wiki](docs/wiki/README.md), task procedures in `.agents/skills/`, and product-facing setup in `README.md`.

## Repository state

- Product status: first Michigan football vertical slice plus a national landscape foundation. `/` remains the Michigan roster explorer; `/games` exposes populated 2000–2026 schedules, weekly importance, proprietary multi-perspective rankings, and custom head-to-head matchups; `/admin/roster` provides deployment-key-gated player maintenance plus recruit, transfer, walk-on, and departure workflows.
- Stack: React 19, TanStack Start/Router, Vite, Nitro, Tailwind CSS 4, React Query, and Convex.
- Runtime: Node.js 22.12 or newer and npm.
- Deployment shape: the web app builds for Vercel; `vercel.json` deploys Convex before the web build.
- Convex environments: development is `adjoining-opossum-710`; production is `doting-chipmunk-7`. Development has the 19-table contract, 2000–2026 proprietary snapshots, and the earlier roster-update mutation, which fails closed until `CFB26_ADMIN_KEY` is configured. The checked-in source adds roster arrival/departure mutations but still needs an authorized development push. Production remains on the prior 17-table, 47,774-document foundation until explicitly promoted.
- Canonical branch: `main`; remote: `origin`.

Do not present placeholders, sample data, or proposed roadmap items as finished product behavior. The wiki labels facts as **Current**, **Planned**, or **Undecided**.

## Commands

Run commands from the repository root.

| Command                                                        | Use                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm install`                                                  | Install the locked dependency graph.                                                 |
| `npm run dev`                                                  | Start Convex development and Vite together; requires a configured Convex deployment. |
| `npm run dev:web`                                              | Start only Vite without synchronizing Convex source.                                 |
| `npm run typecheck`                                            | Run strict TypeScript checks across `src/`, `convex/`, and Vite config.              |
| `npm run lint`                                                 | Run type checking and the TanStack/Convex ESLint rules.                              |
| `npm run build`                                                | Type-check and create the Nitro production output in `.output/`.                     |
| `npm run start`                                                | Preview an existing Nitro production build; requires runtime environment values.     |
| `npm run docs:check`                                           | Validate local links in maintained Markdown.                                         |
| `npm run data:prepare-snaps -- <players.json> <programs.json>` | Prepare the ignored `seasonalPlayerStats` import from `SnapCounts.json`.             |
| `npm run preview:find -- <owner/repo> <sha>`                   | Resolve a direct Vercel preview URL for one pushed commit.                           |
| `npm run check`                                                | Run the full local quality gate: lint, docs links, and production build.             |
| `npm run format`                                               | Format the repository with Prettier; review the resulting diff.                      |
| `npx convex dev --once`                                        | Push backend changes once and regenerate Convex types; requires a linked deployment. |

Do not run deployment, commit, push, or other external-write commands unless the user requested that action.

Secrets must never be committed under any circumstances—not in code, configuration, documentation, examples, fixtures, logs, generated files, or Git history. This includes API keys, tokens, credentials, private keys, and deployment keys. Use placeholders and approved environment/secret stores only. If a secret appears in a diff or commit, stop before pushing and follow [Security and secrets](docs/wiki/operations/security-and-secrets.md).

Confirm the exact target before running `convex dev`, `convex deploy`, or a Vercel build against the recorded Convex environments. See [Deployment](docs/wiki/guides/deployment.md).

## Maintained structure

```text
.
|-- .agents/skills/       Repository-specific agent workflows
|-- convex/               Authored Convex schema and server functions
|   `-- _generated/       Convex CLI output; never hand-edit
|-- docs/wiki/            Detailed, indexed source of project knowledge
|-- public/               Static files copied to the site root
|-- scripts/              Deterministic repository helpers
|-- SnapCounts.json       Raw 2015–2025 Michigan snap-count/PFF season source
|-- src/
|   |-- features/         Domain UI and client-side data orchestration
|   |-- routes/           TanStack file routes; route paths follow filenames
|   |-- styles/           Global styles and Tailwind import
|   |-- routeTree.gen.ts  Router-generated file; never hand-edit
|   `-- router.tsx        Query/Convex providers and router construction
|-- README.md             Human entry point and setup
|-- CLAUDE.md             Pointer to this file only
|-- package.json          Commands and dependency boundaries
|-- vite.config.ts        Vite/TanStack/Tailwind build configuration
`-- vercel.json           Production build orchestration
```

Maintenance rules:

1. Add UI routes under `src/routes/`; let TanStack regenerate `src/routeTree.gen.ts` during dev/build.
2. Add backend code under `convex/`; let the Convex CLI regenerate `convex/_generated/`.
3. Put static, publicly addressable assets in `public/`; do not import application modules from there.
4. Keep detailed documentation under `docs/wiki/`; link every page from its section index and every section index from the wiki home.
5. Keep each skill at `.agents/skills/<skill-name>/SKILL.md`; UI metadata belongs in that skill's `agents/openai.yaml`.
6. Never commit `.env`, `.env.local`, deployment keys, `node_modules/`, `.output/`, `.nitro/`, `dist/`, or tool caches.

## Engineering rules

- Read the relevant wiki page and nearby code before editing. Prefer the smallest coherent change.
- Preserve strict TypeScript. Avoid `any`; if an integration forces it, isolate and explain it.
- Use `~/` for imports rooted at `src/`; use generated `api` references for Convex calls.
- Keep browser-only side effects in components/effects. Routes may render on the server.
- Build responsive, keyboard-usable UI with semantic elements and visible focus behavior.
- Reuse the existing Tailwind design language before adding a component system or dependency.
- Validate every public Convex function argument. Use queries for reads, mutations for transactional writes, and actions only for external or non-transactional work.
- Bound growing Convex reads with an index plus `take`/pagination; do not introduce unbounded `collect()` calls.
- Treat `VITE_*` values as public browser configuration. Server secrets belong in Convex or hosting environment variables without a `VITE_` prefix.
- Update documentation in the same change when behavior, commands, structure, configuration, data contracts, or product status changes.
- Do not edit generated files to fix an upstream source problem. Change the source and regenerate.

## Navigation shortcuts

```powershell
# Inventory maintained files
rg --files -g '!node_modules' -g '!dist' -g '!.git'

# Find routes, Convex calls, and backend exports
rg "createFileRoute|convexQuery|useMutation|useAction|api\." src convex
rg "export const|defineTable|defineSchema" convex -g '!_generated/**'

# Inspect the change surface before verification
git status --short
git diff --stat
git diff
```

Start at [docs/wiki/README.md](docs/wiki/README.md). Use the repository skill whose description precisely matches the task; do not load every skill by default.

For an explicit request to publish a completed goal as a review branch, use `$preview-pr`. It is the only repository workflow that couples new branch creation, logical commits, GitHub push, Vercel preview verification, and PR composition; it never authorizes merge or production promotion.

## Definition of done

A change is complete when the requested behavior works, generated boundaries and secrets are clean, relevant wiki pages agree with the code, and the proportional checks pass. For ordinary code changes, run `npm run check`. A linked Convex backend change also requires `npx convex dev --once` against development before production promotion. Report any check that could not run and why.
