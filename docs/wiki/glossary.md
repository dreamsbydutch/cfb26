# Glossary

[Wiki home](README.md)

| Term               | Meaning in this repository                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Action             | A Convex server function for external/non-transactional work; it may orchestrate queries and mutations.                    |
| ADR                | Architecture decision record under `docs/wiki/decisions/`.                                                                 |
| Convex deployment  | A selected Convex backend environment with functions, data, and environment variables.                                     |
| Composite rating   | CFB26's versioned 0–100 within-season team-strength score, blended from weighted rating perspectives.                      |
| Confidence         | The weighted share of rating-source families available for a team-season; not win probability or statistical certainty.    |
| Foundation         | The stack, documentation, and workflow established before the Michigan personnel vertical replaced the original sample UI. |
| Generated file     | Tool-owned output such as `src/routeTree.gen.ts` or `convex/_generated/`; source changes must be made elsewhere.           |
| Mutation           | A transactional Convex function that may read and write database state.                                                    |
| Rating perspective | One normalized view of team strength or style, such as offense, pass defense, talent, résumé, tempo, or volatility.        |
| Query              | A reactive Convex read function with no database writes.                                                                   |
| Route tree         | TanStack Router's generated typed registry of files under `src/routes/`.                                                   |
| Skill              | A task-specific agent workflow under `.agents/skills/<name>/SKILL.md`, selected by its metadata.                           |
| Vertical slice     | One useful user outcome implemented across backend, UI, states, documentation, and verification.                           |
| Wiki               | The detailed durable documentation rooted at `docs/wiki/README.md`.                                                        |
