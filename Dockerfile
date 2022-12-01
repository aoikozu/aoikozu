FROM node:16-buster-slim AS base
RUN apt-get update && \
    apt-get dist-upgrade -y && \
    apt-get install -y --no-install-recommends python3


FROM base AS builder
RUN apt-get install -y --no-install-recommends g++ make
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build


FROM base AS runner
RUN apt-get install -y --no-install-recommends nscd
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist /app/dist

CMD ["node", "--enable-source-maps", "index.js"]
