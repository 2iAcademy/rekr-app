# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

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
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
