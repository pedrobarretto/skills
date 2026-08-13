---
name: babysit-pr
description: Monitor and babysit a GitHub pull request through review and CI. Use when the user asks to watch, babysit, address, or keep working on a PR until current feedback is handled and checks pass. Includes validating bot findings, making scoped fixes, replying to and resolving false positives, committing, pushing, tracking the base branch, and waiting for new feedback. Merge or close only when explicitly authorized.
---

# Babysit PR

Carry a GitHub pull request through review feedback and CI until it is ready to merge. Review bots are useful, but they are not always right.

Requires the `gh` CLI, authenticated (`gh auth status`).

## Setup

1. Read the PR URL from the user request.
2. Identify the local repository and branch. If the repository is not already open locally, clone or locate it before editing.
3. Run `git status --short` before making changes.
4. Read repo instructions first: `AGENTS.md`, `CLAUDE.md`, `README.md`, package scripts, task docs, and any project-specific PR guidance.
5. Fetch the current PR state:
   - unresolved review threads
   - PR comments
   - requested changes or approvals
   - check runs and CI failures
   - the latest pushed commit and its timestamp
   - the current base branch and mergeability state
6. Prefer harness-provided PR monitoring or wait tools so work resumes when the PR changes. Otherwise, poll checks and comments at a reasonable interval.

## Comment Triage

Use the latest push as the review baseline. Act on checks and comments created after that push. For older unresolved feedback, first verify whether it still applies to the latest commit; never repeat work from stale bot output.

Process exactly one unresolved actionable comment at a time. For each comment, verify the claim against the source before editing and decide whether it is worth fixing.

Fix comments that identify:

- bugs or behavior regressions
- security, auth, permission, data visibility, or privacy risks
- broken CI, type errors, lint errors, or test failures
- missing tests for risky logic
- incorrect API, service, or data boundaries
- real maintainability, correctness, or accessibility issues

Do not blindly fix comments that are:

- stylistic preferences without a repo convention
- already addressed by the current branch
- based on an incorrect assumption
- out of scope for the PR
- likely to make the architecture worse

Comments from review bots deserve the same scrutiny as human ones. Distinguish repository failures caused by the PR from infrastructure flakes. Retry or monitor credible flakes instead of changing product code to appease them.

When review-bot feedback is incorrect, stale, or not worth addressing, reply with a concise written reason and resolve the thread. Format the reply as:

```md
[MODEL-SLUG] RESPONDING ON BEHALF OF PEDRO
-----

[actual reply]
```

Ask the user only when a comment requires a product decision, risky scope expansion, credential access, or a tradeoff that cannot be resolved from the repository and PR context.

## Fix Loop

For each accepted comment:

1. Inspect the surrounding code and existing patterns.
2. Make the smallest correct change that fits the repository architecture.
3. Add or update focused tests when behavior, permissions, calculations, API contracts, or cross-layer logic changes.
4. Run the narrowest useful verification first, then broader checks when needed.
5. Re-check the diff before moving to the next comment.
6. Continue until every actionable comment from the current PR state is handled.

When a comment is not worth fixing, keep a concise rationale for the final report or PR reply if the user asks for one.

Do not let review feedback expand the PR beyond the user's original goal. Fix real shortcomings, but avoid scope creep.

Use screenshots or short videos when visual evidence makes a review response materially clearer. If a file-upload skill or tool is available, use it to attach that evidence.

## Commit And Push

After all actionable feedback from the current pass is handled:

1. Run the repository's expected validation commands.
2. Inspect `git status --short` and `git diff`.
3. Stage only intended files.
4. Commit with a concise message describing the review fixes.
5. Push the current branch.

Do not stage unrelated user changes or revert unrelated work. Do not merge or close the PR unless the user explicitly authorized that action.

## Recheck Loop

After pushing:

1. Wait for CI/checks to complete.
2. Re-fetch review threads, PR comments, approvals, requested changes, and check runs.
3. If CI fails, treat the failure as the next item in the fix loop.
4. If new actionable comments appear, process them one at a time.
5. Repeat until checks pass and there are no actionable unresolved comments.

Never edit CI configuration or workflow files just to make a failing check pass. Keep an eye on changes to the base branch and update the PR branch when needed, using the repository's preferred merge or rebase workflow. If a merge-blocking failure looks unrelated to this PR, check whether the base branch already fixed it before changing code. If the failure still cannot be fixed within the PR's scope, report it instead of working around it.

If another PR makes this one obsolete, stop monitoring, report why, and ask before closing it unless closure was explicitly authorized.

If nothing has changed, stay quiet instead of posting filler PR comments. Continue monitoring without manufacturing work.

Stop when review bots and required checks are green on the latest commit, there are no actionable unresolved comments, and the PR is mergeable; or when there is a concrete blocker requiring user input. Merge only when the user explicitly requested it. Otherwise, report that the PR is ready, including checks, remaining comments, commits pushed, base-branch state, and any unresolved blockers.
