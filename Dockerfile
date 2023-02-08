FROM node:18-buster-slim AS base
RUN apt-get update && \
    apt-get dist-upgrade -y && \
    apt-get install -y --no-install-recommends python3


FROM base AS builder
RUN apt-get install -y --no-install-recommends g++ make
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npx tsc


FROM base AS runner
RUN apt-get install -y --no-install-recommends nscd
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches ./patches/
RUN --mount=type=cache,target=/root/.npm npm pkg delete scripts.prepare && npm ci --omit=dev
COPY --from=builder /app/dist /app/dist
RUN echo DOCKER_BUILD_IMAGE>DOCKER_BUILD_IMAGE
RUN mkdir logs

CMD ["/bin/bash", "-c", "service nscd start; node --enable-source-maps --inspect=8889 --dns-result-order=ipv4first dist/index.js"]
