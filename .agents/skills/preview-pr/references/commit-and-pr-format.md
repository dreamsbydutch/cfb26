# Commit and pull-request format

Read this reference when planning the commits or composing the pull request for `$preview-pr`.

## Branch naming

Pattern:

```text
preview/<goal-slug>
```

Build the slug from the completed outcome, not the original prompt filler. Lowercase it, replace punctuation/whitespace with single hyphens, remove leading/trailing hyphens, and keep it concise enough to scan in GitHub and Vercel.

| Goal                                                | Good branch                            |
| --------------------------------------------------- | -------------------------------------- |
| Rewrite agent documentation and add workflow skills | `preview/document-agent-workflows`     |
| Fix stale number query and empty state              | `preview/fix-number-query-empty-state` |
| Attach the selected Convex deployment               | `preview/connect-convex-deployment`    |

Use a numeric suffix if the ref exists. Do not silently reuse a prior preview branch.

## Commit pattern

Use Conventional Commit-shaped subjects:

```text
<type>(<scope>): <imperative outcome>
```

- Keep the subject specific, normally at most 72 characters, without a trailing period.
- Describe the result in imperative mood: `add`, `document`, `validate`, `fix`, `connect`.
- Scope should name a stable area (`agents`, `docs`, `frontend`, `convex`, `deploy`, `build`) and may be omitted when the change truly spans the repository.
- Do not add AI attribution, session metadata, or vague subjects such as `updates`, `changes`, or `misc fixes`.

| Type       | Use                                               |
| ---------- | ------------------------------------------------- |
| `feat`     | New user/agent capability or observable behavior. |
| `fix`      | Correctness or regression repair.                 |
| `docs`     | Documentation-only behavior/knowledge.            |
| `refactor` | Internal restructuring with unchanged behavior.   |
| `test`     | Automated test coverage only.                     |
| `build`    | Build/dependency/toolchain behavior.              |
| `ci`       | Automation pipeline behavior.                     |
| `chore`    | Necessary maintenance not covered above.          |

### Logical chunk test

A commit is well formed when a reviewer can answer one clear "what/why," its source and generated/test companions agree, and reverting it would remove one coherent outcome. Do not split:

- A schema change from generated types required to compile it.
- A behavior change from the focused test that proves it.
- A command change from the documentation that tells agents to use it.

Do split unrelated outcomes that can be reviewed or reverted independently. If two chunks edit the same file and hunk staging would be fragile, prefer one coherent commit over risky surgery.

For a non-obvious commit, use a short body:

```text
Why:
- <reason or constraint>

Verification:
- `<exact command>`
```

## Pull-request title

Use the same subject pattern, summarizing the complete goal rather than one commit:

```text
feat(agents): publish completed goals as preview PRs
```

## Pull-request body

```markdown
## Goal

<The completed goal and the outcome a reviewer should evaluate.>

## What changed

- <Concrete behavior/architecture change>
- <Supporting documentation or operational change>

## Commits

- `<short-sha>` `<commit subject>` - <why this is a separate logical chunk>

## Verification

- [x] `<command>`
- [x] <manual check and route/state>
- [ ] <skipped check> - <reason>

## Preview

- [Open Vercel preview](https://example-git-sha.vercel.app)
- Deployment commit: `<full-sha>`
- Smoke-tested: <routes and states>

## Risk and rollback

- Risk: <data, environment, compatibility, or "low - documentation only">
- Rollback: <revert/redeploy or feature-specific action>

## Documentation

- <Changed guide/ADR/contract, or "No durable documentation change">

## Follow-ups

- <Known non-blocking work, or "None">
```

Replace every placeholder. Do not include an unchecked item unless it conveys a real, explained gap. The Preview link must be an `https://` deployment URL that opens the rendered application; a GitHub check page or `vercel.com/<team>/<project>/...` dashboard URL is not a direct preview.
