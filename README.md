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

Use Node.js 24.22.3 or newer within the Node 24 release line and the pnpm
version pinned in `package.json`. Payload 3.94 requires this minimum runtime;
the development, CI, and Docker selectors remain on Node 24.

```sh
pnpm install --frozen-lockfile
pnpm generate:types
pnpm check
```

Payload types are generated from the CMS and copied into `libs/payload-types`.
Those generated files are gitignored, so run `pnpm generate:types` before
frontend typechecks or builds in a fresh checkout.
