# syntax = docker/dockerfile:1

# Keep aligned with .nvmrc
ARG NODE_VERSION=26.13.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="React Router"

# React Router app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Install latest corepack to work around this issue: https://github.com/nodejs/corepack/issues/612
RUN npm install -g corepack@latest

RUN corepack enable pnpm

# Throw-away build stage to reduce size of final image
FROM base AS build
ENV CI=true

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY --link package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --link apps/frontend/package.json apps/frontend/
COPY --link libs/shared/package.json libs/shared/
COPY --link libs/payload-types/package.json libs/payload-types/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @fxmk/frontend install --prod=false --frozen-lockfile --store-dir=/pnpm/store

# Copy application code
COPY --link apps/frontend apps/frontend
COPY --link libs/shared libs/shared
COPY --link libs/payload-types libs/payload-types

RUN cp apps/frontend/package.json /tmp/frontend-package.json
ARG APP_VERSION=0.0.0-unknown
RUN node -e "const fs=require('node:fs'); const file='apps/frontend/package.json'; const pkg=JSON.parse(fs.readFileSync(file,'utf8')); pkg.version=process.env.APP_VERSION; fs.writeFileSync(file, JSON.stringify(pkg, null, 2)+'\n');"

# Build application
RUN cd apps/frontend && ./node_modules/.bin/react-router build

# Remove development dependencies
RUN cp /tmp/frontend-package.json apps/frontend/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && pnpm --dir apps/frontend prune --prod


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app
WORKDIR /app/apps/frontend

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "./node_modules/.bin/react-router-serve", "./build/server/index.js" ]
