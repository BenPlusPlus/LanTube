FROM node:24-bookworm-slim

RUN corepack enable

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
CMD ["node", "--import", "remix/node-tsx", "server.ts"]
