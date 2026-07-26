---
name: babysit-pr
description: Babysit a GitHub pull request by working through review comments, PR comments, and CI failures one at a time. Use when the user asks to watch, babysit, address, or keep working on a PR until feedback is handled and checks pass. Includes deciding whether each comment is worth fixing, making scoped code changes, committing, pushing, waiting for CI, re-checking new feedback, and never merging the PR.
---

# Babysit PR

Use this skill to carry a GitHub pull request through review feedback and CI until it is ready for a human to merge. Never merge the PR.

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

## Comment Triage

Process exactly one unresolved actionable comment at a time. For each comment, decide whether it is worth fixing before editing.

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

Comments from review bots deserve the same scrutiny as human ones. Validate the claim against the actual code before acting, and say so when you disagree.

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

## Commit And Push

After all actionable feedback from the current pass is handled:

1. Run the repository's expected validation commands.
2. Inspect `git status --short` and `git diff`.
3. Stage only intended files.
4. Commit with a concise message describing the review fixes.
5. Push the current branch.

Do not stage unrelated user changes. Do not revert unrelated work. Do not merge the PR.

## Recheck Loop

After pushing:

1. Wait for CI/checks to complete.
2. Re-fetch review threads, PR comments, approvals, requested changes, and check runs.
3. If CI fails, treat the failure as the next item in the fix loop.
4. If new actionable comments appear, process them one at a time.
5. Repeat until checks pass and there are no actionable unresolved comments.

Never edit CI configuration or workflow files just to make a failing check pass. If a merge-blocking failure looks unrelated to this PR, check whether the branch is behind its base — another PR may have already fixed it — and merge the base branch in. If the failure still cannot be fixed within the PR's scope, report it instead of working around it.

Stop only when the PR is ready for human merge or there is a concrete blocker requiring user input. Report the final PR state clearly, including checks, remaining comments, commits pushed, and any unresolved blockers.
