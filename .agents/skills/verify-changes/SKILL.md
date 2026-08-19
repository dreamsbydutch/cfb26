---
name: verify-changes
description: "Verify cfb26 changes before handoff, commit, push, pull request, release, or deployment by inspecting the diff and running the proportional TypeScript, ESLint, Markdown-link, production-build, and Convex checks. Trigger on verify, validate, test, check, typecheck, lint, build, CI, review, pre-commit, commit, push, PR, release, deploy, regression, or readiness requests."
metadata:
  short-description: "Diff review and repository quality gates"
  keywords: "verify, validate, test, typecheck, lint, build, CI, review, pre-commit, commit, push, pull request, release, deploy"
---

# Verify Changes

Establish evidence that the current change is safe to hand off. Verification does not authorize a commit, push, deployment, or other external write.

## Inspect first

1. Read [AGENTS.md](../../../AGENTS.md) and [Quality and release](../../../docs/wiki/operations/quality-and-release.md).
2. Run `git status --short`, `git diff --stat`, and `git diff` (plus `git diff --cached` when staged).
3. Confirm the diff contains no secrets, `.env` files, dependency trees, build output, or unexplained generated-file edits.
4. Map changed files to affected behavior and documentation before selecting checks.

## Check ladder

- Documentation only: `npm run docs:check`.
- TypeScript or Convex source: `npm run typecheck`.
- Ordinary code change: `npm run lint` followed by `npm run build`.
- Cross-cutting or pre-release change: `npm run check`.
- Convex backend with a linked deployment: `npx convex dev --once`, then `npm run check`.
- Dependency change: run `npm install`, review `package-lock.json`, then `npm run check`.

Do not claim tests passed: this repository does not yet have an automated test suite. Call the executed checks by name.

## Review invariants

- `src/routeTree.gen.ts` and `convex/_generated/` change only through their generators.
- New routes are reachable and include sensible loading/error/empty behavior when data-bound.
- Convex public arguments are validated and growing reads are bounded/indexed.
- `VITE_*` contains no secrets; local and deployment configuration remain untracked.
- Commands, architecture, data contracts, and product status agree with the wiki.

Report the result as: checks passed, checks skipped with reasons, and any remaining risk. Commit, push, open a PR, or deploy only when the user explicitly requested it.
