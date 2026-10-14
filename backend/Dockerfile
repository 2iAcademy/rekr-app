# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

# Uploads live outside /app, and that placement is load-bearing twice over.
#
# In development compose bind-mounts ./backend onto /app: an uploads directory
# under it would drop user files into the source tree, and `nest start --watch`
# would rebuild the server on every upload.
#
# The directory is created in the image rather than left to the volume, so that
# Docker seeds an empty named volume with this ownership. The production stage
# drops to USER node, which cannot mkdir under /var/lib on its own.
RUN mkdir -p /var/lib/rekr/uploads && chown -R node:node /var/lib/rekr

FROM base AS common
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

FROM common AS build
COPY nest-cli.json ./
COPY src ./src
RUN npx nest build

FROM common AS dev
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

FROM base AS prod-deps
# --omit=dev alone keeps the Prisma CLI, Prisma Studio and TypeScript: they are
# optional peers of @prisma/client, which npm marks devOptional and installs
# unless optional dependencies are left out too. The server never runs them,
# since the client is generated at build time and compiled into dist. The only
# other optional dependency is pg-cloudflare, for Cloudflare Workers.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --omit=optional

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Repeated here because this stage starts from the base image, not from `base`.
RUN mkdir -p /var/lib/rekr/uploads && chown -R node:node /var/lib/rekr
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
