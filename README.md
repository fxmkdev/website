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

For MongoDB and S3 backup/recovery, use `pnpm data backup --env <environment>`
and `pnpm data restore --env <environment>`. See the
[backup CLI guide](tools/backup/README.md) for configuration, required snapshot
paths, destructive-operation confirmation, and disposable recovery checks.

## Automatic Social Preview Images

In the CMS, open **Meta → Social Image Template** and select a base image once.
Pages and posts without a manual **SEO → Social image override** then use that template for Open
Graph, Twitter cards, and RSS images. No image upload is needed for each page or
post. Clear an existing social image override to switch that document to automatic previews.
Manual images retain their existing crops and alternative text.

Use a **1200×630** JPEG, PNG, WebP, or AVIF background with enough contrast for
the title. Configure top, right, bottom, and left margins in pixels to reserve
space for logos or artwork. Margins default to **72 pixels** on every edge.
The remaining text rectangle must fit at least one line and an ellipsis;
invalid combinations of margins and font size cannot be saved.

Choose **Roboto, Open Sans, Montserrat, Lato, Ubuntu, or PT Serif**, in regular or
bold weight, with independent horizontal and vertical alignment. Font sizes
range from 32 to 72 pixels, and colors use six-digit hex values. Defaults remain
bold Roboto, 64 pixels, white (`#FFFFFF`), and bottom-left alignment. Existing
templates retain their appearance when the new settings are absent; no migration
is needed. The single template still has one title overlay. Custom fonts and
multiple templates are outside this feature.

The **Template preview** in global Meta settings uses unsaved settings and an
editable sample title, updating after a short pause. The sample title is not
saved and does not change a page or post. Preview loading and configuration
errors appear in the editor without preventing further editing. Pages and posts
retain the **Social image override** field for manually selected images.

Text fitting uses conservative font-width estimates to wrap and truncate inside
the configured rectangle; it does not perform exact font measurement. Test short,
long, and unbroken titles in the preview. Unicode titles are encoded safely, but
visible glyph coverage depends on ImageKit's font; unsupported characters,
including some emoji, may appear as fallback boxes.

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

The CMS preview, Open Graph/Twitter metadata, and RSS use the same browser-safe
renderer exported from `@fxmk/shared/social-image`. That dedicated entry point
contains the font catalog, defaults, validation, and URL/text-layout logic and
does not import generated Payload types. Run `pnpm generate:types` after CMS
schema changes; import-map generation includes the custom alignment and preview
components. Shared-package type checks use
`pnpm --filter @fxmk/shared exec tsc --noEmit --incremental false`.
