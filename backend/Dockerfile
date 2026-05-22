FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma.config.ts ./
COPY instrument.ts ./
COPY prisma ./prisma
COPY src ./src
COPY test ./test

EXPOSE 3001

CMD ["npm", "run", "start:dev"]