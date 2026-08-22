# cfb26

`cfb26` is a Michigan football personnel explorer built with TanStack Start and Convex. It presents all 428 hosted players through the current depth chart, recruiting and draft classes, exact position groups, search, and detailed player profiles.

## Quick start

Requirements: Node.js 22.12+ and npm.

```bash
npm install
npm run dev:web
```

The browser defaults to the public Michigan development deployment. Set `VITE_CONVEX_URL` in an ignored `.env.local` only to use another compatible deployment. Use the web-only command for now: pushing or deploying the recovered backend remains blocked pending parity review and explicit authorization. See [Deployment](docs/wiki/guides/deployment.md).

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
