# cfb26

`cfb26` is a full-stack React foundation built with TanStack Start and Convex. It currently ships a responsive splash page and a small live-data example while the product domain is being defined.

## Quick start

Requirements: Node.js 22.12+ and access to a Convex deployment.

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `VITE_CONVEX_URL` in `.env.local` before starting. The Convex CLI may also populate the local deployment values when you connect through `npm run dev`.

## Common commands

```bash
npm run typecheck   # TypeScript
npm run lint        # TypeScript + ESLint
npm run build       # Production bundles
npm run docs:check  # Local Markdown links
npm run check       # Full local quality gate
```

## Documentation

- [Agent guide](AGENTS.md) — commands, repository rules, structure, and completion criteria.
- [Wiki home](docs/wiki/README.md) — product status, architecture, workflows, operations, and reference material.
- [Local development](docs/wiki/guides/local-development.md) — setup and everyday workflows.
- [Deployment](docs/wiki/guides/deployment.md) — Convex and Vercel configuration.
- [Product vision](docs/wiki/product/vision.md) — current end goal, boundaries, and open decisions.

Backend contributors should also read [convex/README.md](convex/README.md). Repository-specific agent workflows live under [.agents/skills](.agents/skills).
