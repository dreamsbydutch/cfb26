---
name: preview-pr
description: "Publish a completed cfb26 agent goal as a new preview/goal-slug Git branch with intelligently grouped Conventional Commits, push it to GitHub, obtain and smoke-check the Vercel preview deployment, and create an informative pull request containing the direct preview URL. Trigger only when the user asks to create, publish, ship, or open a preview branch, Vercel preview, or preview PR from the current agent's changes; do not use for ordinary commits, PR review, merge, or production deployment."
metadata:
  short-description: 'Publish completed work as a Vercel preview PR'
  keywords: 'preview PR, preview branch, Vercel preview, GitHub pull request, logical commits, Conventional Commits, publish changes, ship goal'
---

# Preview PR

Turn one completed agent-owned goal into a reviewable branch, deployment, and pull request. The finished PR must identify the goal, explain each logical change, report verification honestly, and link directly to the successful preview - not merely to a Vercel dashboard.

## Authorization boundary

An explicit request such as "publish these changes as a preview PR" or an explicit `$preview-pr` invocation with that intent authorizes only:

- Creating one new `preview/*` branch.
- Committing the current agent's goal-scoped changes.
- Pushing that new branch to the configured GitHub `origin`.
- Triggering/observing the branch's Vercel preview through the existing GitHub integration.
- Creating or updating one pull request for that branch.

It does not authorize merging, force-pushing, production deployment, changing repository/hosting settings, deleting branches, rewriting shared history, or including unrelated user changes. Automatic skill selection without explicit publish intent is not authorization; explain the proposed flow and ask before the first write.

## Read first

1. Read [AGENTS.md](../../../AGENTS.md).
2. Read [Preview pull requests](../../../docs/wiki/guides/preview-pull-request.md) and [Quality and release](../../../docs/wiki/operations/quality-and-release.md).
3. Read [Commit and PR format](references/commit-and-pr-format.md) before planning commits or writing the PR.
4. Use `$verify-changes` for the quality gate; this skill supplies the publishing authorization only when the user explicitly requested it.

## 1. Establish the exact change set

- Confirm the implementation goal being published is complete, even when preview publication is itself the currently active goal. Use goal state when available and conversation evidence otherwise. Do not publish unfinished work.
- Resolve the GitHub repository/default branch with `gh repo view` and fetch the base branch.
- Verify `gh auth status`, `origin`, the current branch, `HEAD`, upstream, status, staged/unstaged diffs, and `origin/<base>..HEAD`.
- Identify exactly which files and existing local commits were produced for this goal. Preserve all unrelated user work.
- If goal changes cannot be separated from unrelated changes with confidence, stop and ask for direction.

## 2. Create a new goal-named branch

Derive a lower-kebab slug from the completed goal's outcome: concise, specific, and normally three to eight terms. Use `preview/<goal-slug>`, for example `preview/add-agent-documentation` or `preview/fix-convex-number-query`.

- Check local and remote refs first. A preview branch must be new; append `-2`, `-3`, and so on when the name exists.
- Never reuse or force-update an existing preview branch.
- The eventual `origin/<base>..preview/<slug>` diff may contain only the completed goal and explicitly accepted prerequisite commits.
- Uncommitted changes may move with `git switch -c <branch>` from the current commit.
- If the agent already made unpublished commits, preserve them when they are logical. If regrouping is necessary, reconstruct the new branch from the remote base without resetting or rewriting the user's base branch; only unpublished, agent-owned commits may be reorganized.
- If local `HEAD` contains older unrelated unpublished commits, do not branch from it. Use an isolated temporary worktree rooted at `origin/<base>` and transfer only the proven goal changes, or stop when that separation is unsafe.
- Never use `git reset --hard`, delete a branch, or rewrite published history as part of this flow.

## 3. Verify and form logical commits

Run the proportional checks from `$verify-changes` before committing. For ordinary cross-cutting work, require `npm run check`; for a linked Convex backend change, also require `npx convex dev --once`. Do not publish a failing change unless the user explicitly asks for a draft that documents the failure.

Present a short commit plan, then create independently understandable chunks:

- Group by outcome or contract, not arbitrary file count.
- Keep implementation with its direct tests/generated contract; place durable documentation with the change it documents when that makes the commit self-contained.
- Stage explicit paths or understood hunks; do not default to `git add -A` when the worktree contains anything outside the goal.
- Inspect every staged diff before committing and ensure no secret, local environment, build output, or unrelated file is included.
- Follow `<type>(<scope>): <imperative outcome>` from the format reference. Use a body when the reason, migration, or verification is not obvious.
- Run a relevant fast check after each risky chunk and the full required gate on final `HEAD`.

## 4. Push without rewriting

Before pushing, inspect the final commit list and diff against `origin/<base>`. Then push once with upstream tracking:

```text
git push -u origin preview/<goal-slug>
```

Capture the exact remote repository, branch, and final commit SHA. Never use `--force` or `--force-with-lease` in this workflow.

## 5. Resolve the Vercel preview

The existing Vercel GitHub integration should create a deployment for the pushed SHA. Poll in short, observable rounds; do not run one silent multi-minute sleep.

```text
npm run preview:find -- <owner/repo> <full-sha>
```

Treat the JSON `state` as the canonical result; package runners may normalize a child's nonzero exit code.

- `success`: smoke-check the direct `environmentUrl` and the changed route(s).
- `not_found` or `pending`: retry about every 15 seconds for up to five minutes, providing a user update at least every 45-60 seconds.
- `failed` or `lookup_error`: preserve the branch and report the failure details.

Open the returned `environmentUrl` and verify an HTTP success plus the changed route(s), content, and states. If Vercel deployment protection prevents access, use an already-authorized browser session when available; never expose or weaken a bypass secret. Keep the PR draft and report the blocker when the rendered app cannot be checked.

Some Vercel projects deploy only after a pull-request event. If no deployment appears after 60-90 seconds, create a **draft** PR with the final body structure and "Preview provisioning" in the Preview section, then continue polling. Once a direct successful URL exists, update the body and mark the PR ready. Never call a Vercel dashboard/check-details URL the preview URL.

If the preview fails or no direct URL appears within five minutes, keep/create the PR as draft with the exact blocker and available logs/check link. Do not mark it ready or claim this flow completed successfully.

## 6. Create the informative PR

Use the format reference. The PR must contain:

- Goal and user-visible outcome.
- Concrete change summary and logical commit list.
- Verification commands and manual checks, distinguishing checks from tests.
- A Markdown link labeled "Open Vercel preview" pointing directly to the successful deployment URL and tied to the final SHA.
- Risk/rollback notes, data or environment impact, documentation changed, and known follow-ups.

Create one PR against the resolved default branch, preferably with `gh pr create --base <base> --head <branch> --title <title> --body-file <temporary-markdown-file>` so shell interpolation cannot corrupt Markdown. If the fallback draft already exists, edit it rather than creating another. Verify the resulting URL, base/head branches, draft state, body, checks, and preview link with `gh pr view`.

## 7. Handoff

Report the branch, ordered commits, final SHA, checks, direct Vercel URL, and GitHub PR URL. State explicitly that the PR is unmerged and no production deployment was performed.

Stop instead of improvising when authentication is unavailable, `origin` is not the intended repository, the goal is incomplete, unrelated changes are inseparable, checks fail, branch creation would overwrite a ref, the preview fails/times out, or the direct deployment URL cannot be proven.
