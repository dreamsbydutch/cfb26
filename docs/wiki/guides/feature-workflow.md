# Feature workflow

[Guides index](README.md) · [Wiki home](../README.md)

Use this workflow for an end-to-end feature, not as ceremony for a one-line documentation fix.

## 1. Establish the outcome

- Identify the user outcome and acceptance criteria.
- Separate **Current**, **Planned**, and **Undecided** behavior.
- Find the owning route, backend module, data table, and wiki pages.
- If product meaning is missing, request or record the decision instead of encoding a guess.

## 2. Design the contract

Define the smallest data and interaction contract before styling:

- Inputs and outputs.
- Ownership/auth requirements.
- Empty, loading, error, and success states.
- Index/query shape and expected growth.
- Whether the operation is a query, mutation, or action.

For an interface-only feature, explicitly state that no backend contract changes.

## 3. Implement backend first when needed

1. Update `convex/schema.ts` and add indexes where the access pattern requires them.
2. Add or revise domain-named Convex functions with validators.
3. Run `npx convex dev --once` when a deployment is linked.
4. Consume the regenerated API references; never manually mimic their types.

Use the repository `$convex-work` skill for the project-specific backend rules.

## 4. Implement the route and UI

1. Add/change the file route under `src/routes/`.
2. Connect reads through `convexQuery` and writes through generated mutation/action references.
3. Implement the complete state model and responsive, keyboard-usable UI.
4. Let the route tree regenerate.

Use `$frontend-work` for route, React, Tailwind, and browser guidance.

## 5. Synchronize knowledge

Update:

- [Current contracts](../reference/current-contracts.md) for public routes/functions/data behavior.
- Frontend/backend architecture when boundaries or patterns change.
- Configuration/deployment docs for environment or build changes.
- [Vision](../product/vision.md) when a product decision becomes current/planned.
- An ADR when the choice has durable architectural consequences.

Use `$maintain-docs` for documentation structure and truth labels.

## 6. Verify and hand off

1. Review `git diff` for accidental output, secrets, or generated-file edits.
2. Run the proportional checks; ordinary features should pass `npm run check`.
3. Exercise the route manually, including failure/empty/narrow viewport states.
4. Report what passed and any remaining deployment or manual verification gap.

Use `$verify-changes` before a commit, push, pull request, release, or deployment. Those external actions still require explicit user authorization.
