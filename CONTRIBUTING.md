# Contributing

This workspace uses squash merges to `main`. The squash commit message comes
from the pull request title, so PR title quality matters.

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
