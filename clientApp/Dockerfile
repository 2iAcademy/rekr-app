FROM node:22-alpine AS base

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package*.json ./

RUN npm ci

COPY --chown=node:node . .

FROM base AS dev

CMD ["npm","run","dev"]

FROM base AS build

# Vite inlines VITE_* variables at build time, so the production DSN has to
# reach this stage as a build argument: setting it on the running container
# would change nothing.
ARG VITE_SENTRY_DSN=""
ARG VITE_SENTRY_ENVIRONMENT=""

RUN npm run build

# Production image: the static build served by Caddy, which also terminates
# HTTPS and forwards /api to the backend. The Caddyfile lives outside this
# build context, in docker/caddy: it comes in as the named context
# `rekr-caddy` (compose.prod.yml, scripts/ci/build-images.sh).
FROM caddy:2.11-alpine AS prod

COPY --from=rekr-caddy Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
