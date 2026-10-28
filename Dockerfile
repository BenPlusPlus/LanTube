FROM node:26-bookworm-slim

RUN corepack enable \
  && apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tzdata \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack prepare pnpm@12.7.0 --activate \
  && pnpm install --frozen-lockfile --prod

COPY remix.json tsconfig.json server.ts ./
COPY app ./app
COPY db ./db
COPY public ./public

ENV NODE_ENV=production
EXPOSE 44100

USER node
CMD ["node", "--import", "remix/node-tsx", "--import", "./app/apply-host-tz.ts", "server.ts"]
