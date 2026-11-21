# Welcome to React Router!

A modern, production-ready template for building full-stack React applications
using React Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

This template includes three Dockerfiles optimized for different package
managers:

- `Dockerfile` - for npm
- `Dockerfile.pnpm` - for pnpm
- `Dockerfile.bun` - for bun

To build and run using Docker:

```bash
# For npm
docker build -t my-app .

# For pnpm
docker build -f Dockerfile.pnpm -t my-app .

# For bun
docker build -f Dockerfile.bun -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports
Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is
production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already
configured for a simple default starting experience. You can use whatever CSS
framework you prefer.

---

Built with ❤️ using React Router.

## React Router v8 maintenance

The frontend uses React Router 8.5.2 with SSR and the default route-module
splitting. It was migrated through React Router 7.18.6 with all five v8 future
flags enabled, following the
[official migration guide](https://reactrouter.com/upgrading/v7). React 19.2.9,
Node 26.13.1, and Vite 8 satisfy the v8 runtime requirements.

Loaders and actions receive the raw HTTP `request`, including internal `.data`
paths and query parameters. Use their normalized `url` argument for public URLs,
CMS lookups, canonical metadata, redirects, and preview parameters. Pass both
`request` and `url` to the routing/environment helpers; they clone the URL and
preserve forwarded HTTPS handling. Metadata functions and parent matches use
`loaderData`.

Run `pnpm check` from the repository root. Against an isolated production
frontend, CMS, and MongoDB test stack, run
`pnpm --filter @fxmk/e2e exec playwright test`. Configure `FRONTEND_BASE_URL`,
`CMS_BASE_URL`, `CMS_API_KEY`, and `EXPECTED_VERSION` for that stack; its
frontend and CMS must share `PREVIEW_KEY` (the Compose default is
`preview-key`). Set `CANONICAL_HOSTNAME` if it differs from
`canonical.localhost`. If the frontend uses an internal CMS URL, set
`CMS_PREVIEW_ORIGIN` to that URL for the preview test. The router suite creates
test documents/users, updates test navigation, and covers SSR without
JavaScript, client data requests and history, redirects, resource GET/HEAD
responses, authenticated cache invalidation, and page/post draft and live
previews. Use a disposable database and test media storage, since these tests
write CMS data.
