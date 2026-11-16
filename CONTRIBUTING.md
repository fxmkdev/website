# Contributing

This workspace uses squash merges to `main`. The squash commit message comes
from the pull request title, so PR title quality matters.

## Feature Branch Workflow

These rules apply to all contributors and coding agents.

- Before starting implementation work, run `git fetch origin` and base new
  branches or worktrees on the freshly fetched `origin/main`.
- When updating an existing feature branch with changes from `main`, always run
  `git fetch origin` followed by `git rebase origin/main` from the feature
  branch. Never merge `main` or `origin/main` into a feature branch.
- If the rebase encounters conflicts, resolve them, stage the resolved files
  with `git add -- <paths>`, and run `git rebase --continue`. Repeat until the
  rebase completes; do not switch to a merge to avoid resolving rebase
  conflicts.
- Preserve individual commits during rebases by default. If replaying
  intermediate commits would cause avoidable or repeated conflict resolution,
  consider proposing a squash. Explain why it would help, identify the commits
  to combine, and describe the loss of individual commit history. Obtain
  explicit user confirmation of that proposal before squashing; permission to
  rebase, resolve conflicts, or force-push does not imply permission to squash.
- Without that confirmation, preserve the commits. After confirmation, combine
  only the approved commits, preserve their combined changes, and rebase onto
  freshly fetched `origin/main`. This approval requirement applies to rewriting
  feature-branch history; completed PRs retain the existing squash-merge policy.
- After rebasing a published feature branch, push the rewritten history with
  `git push --force-with-lease origin <feature-branch>`. Use the same remote
  branch so its open PR updates in place. If the lease fails, fetch and inspect
  the remote changes and incorporate any collaborators' work before retrying.
  Never bypass the lease with `--force`.

Completed pull requests continue to use squash merges into `main`.

## Pull Request Title Convention

All pull request titles must follow Conventional Commits:

`<type>(optional-scope): <description>`

Examples:

- `feat(frontend): add newsletter archive page`
- `fix(cms): refresh frontend cache after publishing`
- `docs: clarify local development checks`
- `chore(infra): update Fly deployment workflow`

Recommended types:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `ci`
- `build`
- `perf`

## Commit Messages Inside the PR

Commits inside a pull request can stay descriptive for review flow and do not
need to be strictly Conventional Commit formatted.

## Pull Request Description Workflow

- Prefer `gh pr create --body-file <path>` over `--body` to avoid shell
  escaping/newline formatting issues in PR descriptions.
- Prefer `gh pr edit --body-file <path>` for updates.
- If `gh pr edit` fails with a GraphQL error mentioning `projectCards`
  deprecation, update the body through REST:
  `gh api -X PATCH repos/<owner>/<repo>/pulls/<number> -f body="$(cat <path>)"`.

## Scope Guidance

Use an app or area scope when helpful:

- `frontend`
- `cms`
- `payload-types`
- `shared`
- `e2e`
- `infra`
- `docs`

Keep descriptions concise, imperative, and behavior-focused.

## Runtime and Typings Policy

- Use Node.js 24, as pinned in `.nvmrc` and CI.
- Keep `@types/node` on the Node 24 line until runtime migration is scheduled.

## Review Comment Workflow

- If the current Codex/chat thread is linked to an open pull request, push newly
  applied changes to that PR branch unless explicitly instructed otherwise.
- After you address a pull request comment, resolve that conversation in the PR.

## Documentation Expectations

- Update relevant docs when introducing new behavior or conventions.
- Keep shared workspace docs at the repository root or in `docs/` if a topic
  grows beyond a short root-level guide.
- Keep app/package docs alongside code when they only apply to one workspace
  package.
