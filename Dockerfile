# syntax=docker/dockerfile:1.4
FROM node:20-bullseye-slim AS base
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get dist-upgrade -y && \
    apt-get install -y --no-install-recommends python3


FROM base AS builder
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends g++ make
WORKDIR /app
COPY --link package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY --link ./src ./src
COPY --link ./tsconfig.build.json ./bakeDynamicImports.mjs build.mjs ./
RUN node bakeDynamicImports.mjs && \
    npx tsc -p tsconfig.build.json && \
    node build.mjs && \
    mv ./dist/index.min.js ./dist/index.js && \
    mv ./dist/worker.min.js ./dist/worker.js


FROM base AS deps
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends build-essential
WORKDIR /app
COPY --link package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev


FROM base AS runner
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends nscd ca-certificates && \
    ln -s /usr/bin/python3 /usr/bin/python
WORKDIR /app
RUN mkdir logs && \
    echo DOCKER_BUILD_IMAGE>DOCKER_BUILD_IMAGE
COPY --link package.json package-lock.json ./
COPY --link --from=deps /app/node_modules /app/node_modules
COPY --link --from=builder /app/dist /app/dist
COPY --link ./locales ./locales

CMD ["/bin/bash", "-c", "service nscd start; exec node --dns-result-order=ipv4first dist/index.js"]
