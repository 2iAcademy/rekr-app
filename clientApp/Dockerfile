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

RUN npm run build
