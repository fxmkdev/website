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

- Use Node.js 26.13.1, as pinned in `.nvmrc`, CI, and Docker.
- Keep runtime constraints at `>=26.13.1 <27` and `@types/node` on the Node 26
  line, aligned through the workspace override.

## Package Manager

Use the exact pnpm version pinned in `package.json#packageManager`. Install it
with `npm install --global pnpm@12.21.0`, then run
`pnpm install --frozen-lockfile` from the repository root. pnpm 12 validates
workspace settings strictly; keep non-registry configuration in
`pnpm-workspace.yaml`, not `.npmrc`.

Workspace dependencies use symlinks so generated Payload types are immediately
visible to their consumers. Workspace injection is intentionally disabled; the
old `.npmrc` injection setting was already ignored by pnpm 11.

When upgrading pnpm, update all four `packageManager` pins with the verified npm
tarball integrity and both Docker image pins together. The frontend copies pnpm
from the Debian image; the CMS uses its Alpine variant to match musl. Docker
copies the complete `/opt/pnpm` directory, including pnpm's bundled `node-gyp`.
The lockfile stays on format 9; no experimental lockfile format is enabled. pnpm
12 adds a separate YAML document locking pnpm and its platform binaries; the
application dependency document is unchanged. Lockfile readers and scanners must
handle both YAML documents.

## Review Comment Workflow

- If the current Codex/chat thread is linked to an open pull request, push newly
  applied changes to that PR branch unless explicitly instructed otherwise.
- After you address a pull request comment, resolve that conversation in the PR.

## Deployment Verification

Preview deployments explicitly allocate shared IPv4 and public IPv6 addresses.
Deployments must pass public HTTPS checks for the frontend `/version` and CMS
`/api/users/me` endpoints within five minutes. A successful Fly deployment alone
does not establish public reachability. Keep the Fly CLI version aligned across
the build, deploy, and preview-cleanup workflows.

## Documentation Expectations

- Update relevant docs when introducing new behavior or conventions.
- Keep shared workspace docs at the repository root or in `docs/` if a topic
  grows beyond a short root-level guide.
- Keep app/package docs alongside code when they only apply to one workspace
  package.
