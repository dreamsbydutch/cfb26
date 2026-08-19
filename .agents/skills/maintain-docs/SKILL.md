---
name: maintain-docs
description: "Create, rewrite, audit, or synchronize cfb26 documentation: AGENTS.md, CLAUDE.md, README files, docs/wiki pages, architecture maps, setup guides, command references, product vision, ADRs, and repository skills. Trigger on docs, documentation, wiki, README, AGENTS.md, CLAUDE.md, architecture, repository map, onboarding, runbook, ADR, product vision, or agent-instructions requests, and when code changes invalidate documented facts."
metadata:
  short-description: "Agent guidance, wiki, runbooks, and ADRs"
  keywords: "docs, documentation, wiki, README, AGENTS.md, CLAUDE.md, architecture, repository map, onboarding, runbook, ADR, product vision"
---

# Maintain Docs

Keep repository knowledge navigable, non-duplicative, and traceable to the code.

## Source hierarchy

- `AGENTS.md`: concise commands, invariants, structure, navigation, and definition of done.
- `CLAUDE.md`: pointer to `AGENTS.md` only.
- `README.md`: short human entry point, setup, and links.
- `convex/README.md`: local backend contract and rules.
- `docs/wiki/`: durable explanations, product truth, architecture, guides, operations, and decisions.
- `.agents/skills/`: task-specific workflows and trigger metadata.

Do not duplicate long explanations across layers. Link to the owning page.

## Workflow

1. Read [AGENTS.md](../../../AGENTS.md) and the [wiki home](../../../docs/wiki/README.md).
2. Inspect the source/configuration that proves each claim. Do not document assumptions as facts.
3. Label product statements as **Current**, **Planned**, or **Undecided**. Never convert a placeholder or aspiration into shipped behavior.
4. Add every durable page to the wiki navigation and its section index. Use descriptive relative links and stable headings.
5. When a durable architectural decision is made, add an ADR and update the decision index.
6. When a workflow repeats and needs non-obvious project guidance, add or refine one narrowly triggered skill. Keep automatic selection enabled unless explicitly told otherwise.

## Writing rules

- Lead with the answer, then constraints and procedure.
- Prefer tables for contracts/maps and short lists for rules; avoid prose walls.
- Include exact commands only when they work in this repository.
- State prerequisites, side effects, generated boundaries, secret handling, and known gaps.
- Preserve historical context in ADRs, not in operational guides.

Run `npm run docs:check` after every documentation change. For a new or substantially changed skill, also run the skill-creator `quick_validate.py` against its folder. If documentation accompanies code, use the checks required by the code change as well.
