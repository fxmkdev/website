# fxmk.dev Website

[![Build](https://github.com/felixmokross/website/actions/workflows/build.yml/badge.svg)](https://github.com/felixmokross/website/actions/workflows/build.yml)

This is my personal website [fxmk.dev](https://fxmk.dev). All content is
controlled via a tailored, headless CMS based on
[Payload CMS](https://payloadcms.com/). The frontend is powered by the
[React Router framework (formerly Remix)](https://reactrouter.com).

## Tech Stack

- [React Router framework (formerly Remix)](https://reactrouter.com/)
- [Payload CMS](https://payloadcms.com/)
- [MongoDB](https://www.mongodb.com/)

## Local Maintenance

Use Node.js 26.13.1 and the pnpm version pinned in `package.json`. Local
development, CI, and Docker use this exact Node release; package engine
constraints support `>=26.13.1 <27`. Node typings stay on the Node 26 line
through the workspace override. Run `nvm install` and `nvm use` to select the
version in `.nvmrc`.

```sh
pnpm install --frozen-lockfile
pnpm generate:types
pnpm check
```

Payload types are generated from the CMS and copied into `libs/payload-types`.
Those generated files are gitignored, so run `pnpm generate:types` before
frontend typechecks or builds in a fresh checkout.

The development and E2E Compose files use `mongo:8.0` to follow production's
MongoDB 8.0 release line while allowing patch updates. Keep both image tags in
sync when production moves to a new release line.

If a local volume was initialized by a newer MongoDB release, do not reuse it
with 8.0. Start a fresh database with a separate Compose project, for example
`docker compose -p website-cms-mongo80 -f apps/cms/docker-compose.yml up -d`,
and preserve the original volume for recovery.

Dependency security overrides live in `pnpm-workspace.yaml`, alongside an
explicit 24-hour minimum release age. Prefer compatible upstream updates, remove
obsolete overrides, and use exact-version release-age exceptions only when a
security fix requires one. Run both `pnpm audit` and `pnpm audit --prod` after
updating the lockfile.

The remaining overrides keep Node typings on major 26, patch Tailwind
Typography's selector parser, and retain scoped security exceptions for Happy
DOM 20 and minimatch 10. Those last two resolve to patched major versions
because their requested majors lack fixes; recheck their upstream consumers
before removing the exceptions.

For MongoDB and S3 backup/recovery, use `pnpm data backup --env <environment>`
and `pnpm data restore --env <environment>`. See the
[backup CLI guide](tools/backup/README.md) for configuration, required snapshot
paths, destructive-operation confirmation, and disposable recovery checks.

## Docker validation

Generate Payload types before building the frontend image. Build both image
families on ARM64 and AMD64 to exercise native dependencies with glibc
(frontend) and musl (CMS):

```sh
pnpm generate:types
for arch in arm64 amd64; do
  docker build --pull --platform "linux/$arch" \
    -f apps/frontend/Dockerfile -t "website-frontend:node26-$arch" .
  docker build --pull --platform "linux/$arch" \
    -f apps/cms/Dockerfile -t "website-cms:node26-$arch" .
  docker run --rm --platform "linux/$arch" \
    --entrypoint node "website-frontend:node26-$arch" --version
  docker run --rm --platform "linux/$arch" \
    --entrypoint node "website-cms:node26-$arch" --version
done
```

Both images must report `v26.13.1`. Validate Sharp image processing in the CMS
image and start both applications with disposable local services before
publishing. Reinstall dependencies after switching Node majors so native
packages are installed for the selected runtime and platform.
