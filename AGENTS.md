# AGENTS.md

Guidance for coding agents and contributors working in this repository.

This repository contains the source for [fxmk.dev](https://fxmk.dev), with a
React Router frontend and a Payload CMS backend.

## Repository-wide Guidelines

- Use `pnpm` as package manager.
- Use Node.js 26.13.1, as pinned in `.nvmrc`, CI, and Docker.
- Keep changes focused and minimal; avoid unrelated refactors.
- Keep docs in sync when introducing new patterns or conventions.
- Before starting implementation work, run `git fetch origin` and base new
  branches or worktrees on the freshly fetched `origin/main`.
- When updating an existing feature branch with changes from `main`, always run
  `git fetch origin` followed by `git rebase origin/main`. Never merge `main` or
  `origin/main` into a feature branch. Resolve conflicts and continue the rebase
  rather than switching to a merge.
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
- After rebasing a published feature branch, push the rewritten history to the
  same remote branch with `git push --force-with-lease origin <feature-branch>`
  so its open PR updates in place. If the lease fails, inspect the remote
  changes before retrying; never bypass it with `--force`.
- Preserve user changes you did not make, especially in a dirty worktree.
- Pull request titles must follow Conventional Commits because GitHub squash
  merge uses the PR title as the commit on `main`.
  - Format: `<type>(optional-scope): <description>`
  - Example: `feat(frontend): add newsletter archive page`
  - Use descriptive commits inside the PR for review clarity; the PR title is
    the canonical squash commit message.
- When the current Codex/chat thread already has an open pull request, push any
  newly applied changes to that PR branch unless explicitly instructed
  otherwise; fetch first and follow the rebase requirement above when
  `origin/main` has advanced beyond the branch base.
- After you address a pull request review comment, resolve that conversation in
  the PR.
- Keep `@types/node` aligned with the current runtime major (Node 26). Keep
  runtime constraints within `>=26.13.1 <27` until the next runtime migration.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guidelines.

## Repository Structure

- Frontend app: `apps/frontend`
- Payload CMS app: `apps/cms`
- Generated Payload types package: `libs/payload-types`
- Shared workspace package: `libs/shared`
- End-to-end tests: `tests/e2e`
- Backup/recovery CLI: `tools/backup` (`@fxmk/backup-tools`)
- Release tooling: `@fxmk/releaser`

## Development Commands

```bash
pnpm install --frozen-lockfile             # Install dependencies
pnpm generate:types                        # Generate/copy Payload types
pnpm check                                 # Full local check pipeline
pnpm lint                                  # Lint frontend, CMS, and backup tools
pnpm check-format                          # Prettier check for apps and backup tools
pnpm typecheck                             # Generate types, then typecheck frontend and backup tools
pnpm typecheck:generated                   # Typecheck frontend and tools with existing generated types
pnpm test                                  # Run frontend and backup tool tests
pnpm build                                 # Generate types, then build frontend and CMS
pnpm build:generated                       # Build with existing generated types

pnpm --filter @fxmk/frontend dev           # Start frontend dev server
pnpm --filter @fxmk/frontend build         # Build frontend
pnpm --filter @fxmk/frontend typecheck     # React Router typegen + tsc
pnpm --filter @fxmk/frontend lint          # ESLint check
pnpm --filter @fxmk/frontend check-format  # Prettier check
pnpm --filter @fxmk/frontend test          # Vitest watch mode

pnpm --filter @fxmk/cms dev                # Start Payload CMS dev server
pnpm --filter @fxmk/cms build              # Generate types, then build CMS
pnpm --filter @fxmk/cms build:generated    # Build CMS with existing generated types
pnpm --filter @fxmk/cms generate:types     # Generate Payload types
pnpm --filter @fxmk/cms lint               # CMS lint check
pnpm --filter @fxmk/cms check-format       # CMS Prettier check

pnpm --filter @fxmk/payload-types pull-payload-types # Populate libs/payload-types
pnpm --filter @fxmk/e2e e2e                         # Open Playwright UI
```

## Generated Types

Payload types are generated from the CMS and copied into `libs/payload-types`.
Those generated files are gitignored. Run `pnpm generate:types` before frontend
typechecks or builds in a fresh checkout.

## Quality Checklist

- Run `pnpm check` before finishing broad or cross-package changes.
- Run `pnpm generate:types` before checks that depend on Payload types.
- Run `pnpm lint` when touching TypeScript, React, or CMS code.
- Run `pnpm check-format` when touching formatting-sensitive files.
- Run `pnpm test` when touching tested frontend behavior.
- Run `pnpm build` when changing build configuration, shared types, or cross-app
  contracts.
- Run the relevant app-specific command for narrowly scoped changes when the
  full check pipeline is unnecessary.
- Update docs when behavior, commands, architecture, or conventions change.
