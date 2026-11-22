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
