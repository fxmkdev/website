# fxmk.dev Website

[![Build](https://github.com/felixmokross/website/actions/workflows/build.yml/badge.svg)](https://github.com/felixmokross/website/actions/workflows/build.yml)

This is my personal website [fxmk.dev](https://fxmk.dev). All content is
controlled via a tailored, headless CMS based on [Payload CMS](https://payloadcms.com/).
The frontend is powered by the
[React Router framework (formerly Remix)](https://reactrouter.com).

## Tech Stack

- [React Router framework (formerly Remix)](https://reactrouter.com/)
- [Payload CMS](https://payloadcms.com/)
- [MongoDB](https://www.mongodb.com/)

## Local Maintenance

Use Node.js 24 and the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm generate:types
pnpm check
```

Payload types are generated from the CMS and copied into `libs/payload-types`.
Those generated files are gitignored, so run `pnpm generate:types` before
frontend typechecks or builds in a fresh checkout.

## Automatic Social Preview Images

In the CMS, open **Meta → Social Image Template** and select a base image once.
Pages and posts without a manual **SEO → Image** then use that template for Open
Graph, Twitter cards, and RSS images. No image upload is needed for each page or
post. Clear an existing SEO image to switch that document to automatic previews.
Manual images retain their existing crops and alternative text.

Use a **1200×630** JPEG, PNG, WebP, or AVIF background with enough contrast for
the title and space inside a **72-pixel margin**. The single template supports
top-left, center, and bottom-left titles, a font size from 32 to 72 pixels, and
a six-digit hex text color. Defaults are bottom-left, 64 pixels, and white
(`#FFFFFF`), with bold Roboto typography. Any logo or other fixed artwork belongs
in the base image. There is one title overlay; multiple templates and custom
fonts are outside this initial feature. Unicode titles are encoded safely, but
visible glyph coverage depends on ImageKit's built-in Roboto font; unsupported
characters, including some emoji, may appear as fallback boxes.

Generated images use the document title, falling back to the SEO title if the
document title is blank. Whitespace is normalized, long titles wrap within the
safe area, and overflowing text is shortened with an ellipsis. Alt text retains
the full title. Generated previews are 1200×630 JPEGs, rendered and cached by
ImageKit using the existing `IMAGEKIT_BASE_URL`. The CMS does not store
generated images or require new ImageKit credentials.

Before a base image is selected, documents without manual images safely omit
image metadata. Missing or unresolved media references are also handled safely.
The optional settings require no content migration or per-document republishing.
Deploy the CMS configuration before or alongside the frontend.

Saving Meta settings refreshes the frontend's global Meta cache through the
existing cache-refresh mechanism. Title and template settings are included in
the generated URL, so changing them selects a new ImageKit rendition. Replace
the base with a newly uploaded file when changing its artwork, so it has a new
filename and URL. Social platforms may keep their own cached previews; use their
sharing/debugging tools to request a refresh after publishing changes.
