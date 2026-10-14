# Rekr

Monorepo: `backend/` (NestJS + Prisma + PostgreSQL) + `clientApp/` (React + Vite).

## Stack

| Folder        | Contents                                                                       |
| ------------- | ------------------------------------------------------------------------------ |
| `backend/`    | NestJS 11 API (TypeScript) · **Prisma 7** ORM · PostgreSQL 18 · Kafka producer |
| `clientApp/`  | React + Vite frontend                                                          |
| `compose.yml` | Local stack: PostgreSQL, backend, frontend                                     |

## Getting started

### Prerequisites

- Docker + Docker Compose
- Node.js 20+ (to run Prisma commands from the host)

### 1. Start the stack

```bash
docker compose up -d
```

No `.env` is needed: `compose.yml` provides development defaults (database, throwaway `JWT_SECRET`), and the
backend applies the Prisma migrations every time its container starts.

This starts `postgres` (5432), `elasticsearch` (9200), `backend` (3001) and `frontend` (8080). The API answers on
`http://localhost:3001/api`, Swagger on `http://localhost:3001/api/docs`.

### 2. Customise (optional)

```bash
cp .env.example .env                  # overrides the compose.yml values (ports, SMTP, Sentry...)
cp backend/.env.example backend/.env  # for commands run from the host (Prisma CLI, Prisma Studio)
```

⚠️ The Postgres credentials in the root `.env` and the `DATABASE_URL` in `backend/.env` must match.

The development `JWT_SECRET` is public: the API refuses to start with it, or with any secret shorter than 32
characters, when `NODE_ENV=production`.

### Kafka / logs

Flow: `backend` (producer) → Kafka topic `logs.raw` → `logs-sink` (consumer) → Postgres table `logs_raw`.

This pipeline has its own stack, `docker/docker-compose.yml`, separate from the root `compose.yml`. Run the commands below from the repository root.

1. Start Kafka, Kafka UI and Postgres, then apply the migrations **before** `logs-sink`. Otherwise `logs-sink` creates `logs_raw` in an empty database, and `prisma migrate deploy` then refuses to migrate it (P3005).

```bash
export JWT_SECRET="<long-random-secret>"   # the API refuses to start without it
docker compose -f docker/docker-compose.yml up -d --build kafka kafka-ui postgres backend
docker compose -f docker/docker-compose.yml exec backend npx prisma migrate deploy
docker compose -f docker/docker-compose.yml up -d logs-sink
```

If port 5432 is already taken on the host, prefix the commands with `POSTGRES_PORT=55433`. Elasticsearch is not part of this stack: the backend runs there with `ELASTICSEARCH_ENABLED=false`.

2. Get an admin token. `/api/logs/*` is restricted to the `admin` user type, which cannot be obtained at sign-up: create an account, promote it to admin in the database, then log in.

```bash
curl -s -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.localhost","password":"<password>","userType":"candidate","acceptTerms":true}' \
  http://localhost:3001/api/auth/signup
docker compose -f docker/docker-compose.yml exec postgres psql -U ${POSTGRES_USER:-user} -d ${POSTGRES_DB:-backend} \
  -c "UPDATE \"user\" SET user_type='admin', role='admin' WHERE email='admin@test.localhost';"
TOKEN=$(curl -s -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.localhost","password":"<password>"}' \
  http://localhost:3001/api/auth/login | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
```

3. Produce a test message, then a simulated error:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/logs/sample
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"test error"}' http://localhost:3001/api/logs/error
```

4. Check that the messages are consumed:

```bash
docker compose -f docker/docker-compose.yml logs -f logs-sink
```

5. Check in Kafka UI: http://localhost:8085 (topic `logs.raw`, Messages tab).

6. Check that the events are stored in the database:

```bash
docker compose -f docker/docker-compose.yml exec postgres psql -U ${POSTGRES_USER:-user} -d ${POSTGRES_DB:-backend} -c "SELECT event_id, level, message, occurred_at FROM logs_raw ORDER BY created_at DESC LIMIT 10;"
```

### 3. Initialise the database (from the host)

```bash
cd backend
npm install
npx prisma migrate dev   # creates and applies the migrations
npx prisma generate      # generates the Prisma client
```

On the Docker network, the API answers at `http://backend:3001/api`.
From the host, the exposed URL is `http://localhost:3001/api` when Docker port forwarding is available.
Swagger documentation: `http://localhost:3001/api/docs` (OpenAPI JSON: `http://localhost:3001/api/docs-json`).

## Authentication (signup / login)

The backend exposes:

- `POST /api/auth/signup`
- `POST /api/auth/login`

Required variable in `backend/.env`:

```bash
JWT_SECRET="<long-random-secret>"
```

Payloads:

- `signup`: `{ "email": "user@mail.com", "password": "min8chars", "userType": "candidate" | "recruiter" }`
- `login`: `{ "email": "user@mail.com", "password": "min8chars" }`

The response holds an `accessToken` and a `user` object (without the password).

## Messaging — Stream Chat

Messages between a candidate and their match are stored by [Stream](https://getstream.io/chat/). The API decides who gets access: `POST /api/chat/token` signs a one-hour Stream token, and `POST /api/matches/:id/chat` opens the match's conversation once the caller is recognised (the candidate, or a recruiter from the offer's company). Each time the conversation is opened, the API resets the channel: created by the `rekr-system` system user, with no member outside the match, and frozen if the offer is no longer published.

Variables (root `.env` for docker compose, `backend/.env` outside Docker):

```bash
STREAM_API_KEY=""     # dashboard.getstream.io > <app> > Overview > App Access Keys
STREAM_API_SECRET=""  # same place; stays on the backend, never in a VITE_ variable
```

Without these keys the API still starts, and only the messaging routes answer 503.

Settings expected in the Stream app dashboard, to be applied to every environment. The code does not rely on them to decide who joins a conversation, but they block what a client token could do by calling Stream directly:

- `messaging` channel type, `user` and `channel_member` roles: no channel creation, no member changes, no channel update (hence no unfreezing);
- `messaging` channel type: uploads disabled;
- app settings: user search forbidden to the `user` role (`user_search_disallowed_roles`);
- `user` role: cannot edit its own profile (the display name comes from the API);
- storage region: EU.

## Database — Prisma

The schema lives in `backend/prisma/schema.prisma`. Run every command from `backend/`.

```bash
npx prisma migrate dev --name <description>  # change the schema → new migration (dev)
npx prisma generate                          # regenerate the client after a schema change
npx prisma studio                            # browse the data in the browser
```

- Migrations run **from the host**, connected to `localhost:5432`. In production: `npx prisma migrate deploy`.
- **Prisma 7**: the client is generated as CommonJS (`moduleFormat = "cjs"` in the `generator` block) to stay compatible with NestJS.

## Adding an npm dependency to the backend

The `backend` container has its **own** `node_modules` (anonymous volume). After adding a dependency, rebuild the image **and** renew that volume:

```bash
npm --prefix backend install <package>
docker compose up -d --build --renew-anon-volumes backend
```

> `docker compose up --build` alone is not enough: the old `node_modules` volume hides the new image. `--renew-anon-volumes` is required.

## Quality checks

The `CI Backend` workflow (`Lint` job) and the `CI Frontend` workflow (`Lint` job) check the code on every pull request. To run them locally:

|              | Backend (`backend/`)                 | Frontend (`clientApp/`)                  |
| ------------ | ------------------------------------ | ---------------------------------------- |
| Check        | `npm run lint:check`                 | `npm run lint`                           |
| Check format | `npm run format:check`               | `npm run format:check`                   |
| Fix          | `npm run lint` then `npm run format` | `npm run lint:fix` then `npm run format` |

The `lint` (backend) and `lint:fix` (frontend) variants **fix** the files: they are not checks. CI only uses the `:check` commands.

Line endings are normalised to LF through `.gitattributes`: ESLint tolerates CRLF (`endOfLine: "auto"`), but `prettier --check` rejects it.

## Code analysis — SonarQube Cloud

The analysis runs in CI on [SonarQube Cloud](https://sonarcloud.io) (free, since the repository is public). The `CI Sonar` workflow produces the backend and frontend coverage reports, then runs a single analysis for the whole monorepo.

### Configuration

Two repository secrets are required (**Settings → Secrets and variables → Actions**):

| Secret           | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| `SONAR_TOKEN`    | token generated on SonarQube Cloud (**My Account → Security**) |
| `SONAR_HOST_URL` | `https://sonarcloud.io`                                        |

While either one is missing, the job only emits a notice and passes, so CI does not turn red.

The project configuration lives in `sonar-project.properties` at the root: `sonar.projectKey` and `sonar.organization` must match the ones shown on the Cloud dashboard.

### Coverage

`sonar.javascript.lcov.reportPaths` reads `backend/coverage/lcov.info` and `clientApp/coverage/lcov.info`, produced by `npm run test:cov` in each folder.

### Local scan (optional)

There is no self-hosted instance any more: a local scan targets Cloud directly.

```bash
SONAR_TOKEN=<token> docker run --rm -e SONAR_TOKEN -e SONAR_HOST_URL=https://sonarcloud.io -v "$PWD:/usr/src" sonarsource/sonar-scanner-cli
```

Run the tests with coverage before the scan, otherwise the analysis reports 0%.

## Elasticsearch candidate-feed ranking

The local Compose stack includes Elasticsearch at `http://localhost:9200`. It is a development-only single node with Elastic security disabled; do not copy that setting to production.

The backend indexes open offers and uses Elasticsearch only to rank candidate-feed offer ids. PostgreSQL rechecks that every returned offer is still open and has not already been liked or passed, then reads the card data. If Elasticsearch is disabled or unavailable, the feed safely falls back to the existing newest-first PostgreSQL ordering. When Elasticsearch does not answer, the backend retries in the background (5 s, doubling up to 5 min), then creates the index if it is missing and re-aligns it on PostgreSQL, logging the drift it fixed (`Elasticsearch drift: …`). No restart is needed after an outage.

The ranking weights are intentionally explicit and all live in `backend/src/search/ranking/ranking-rules.ts`: skills 5, seniority 4, contract type 3, salary 3, location 1, freshness 1. Remote work carries no weight — it excludes only. **[docs/ranking-du-feed-candidat.md](docs/ranking-du-feed-candidat.md) explains what filters, what ranks, and why**, with a worked trace. Set `ELASTICSEARCH_ENABLED=false` to force the fallback, override `ELASTICSEARCH_NODE` for another secured cluster, or set `ELASTICSEARCH_REINDEX_ON_STARTUP=true` for a deliberate rebuild from PostgreSQL.

### How candidate-feed ranking works

Two mechanisms, deliberately kept apart. A **filter** removes an offer from the deck: the trade, a remote arrangement the candidate cannot hold, and the single contract pair that is a status rather than a preference (apprenticeship/internship against everything else). A **weight** orders what is left, and never subtracts — an offer that left a field empty earns nothing on it rather than being pushed down.

Every number is in `backend/src/search/ranking/ranking-rules.ts`, including the three affinity matrices. The builder beside it, `offer-ranking.ts`, only turns them into a query and holds no value of its own; it is pure, so `offer-ranking.spec.ts` asserts the whole ranking without a cluster. **To change the ranking, edit a number in `ranking-rules.ts` — not the builder.**

After Elasticsearch returns ranked ids, PostgreSQL re-applies the hard eligibility rules: the offer must be open, must pass the same trade/remote/contract exclusions, and must not already be liked or passed. This prevents a delayed search index from exposing an ineligible card, and it is why the exclusions are exported (`allowedContractTypes`, `allowedRemotePolicies`) rather than expressed in the query alone — the ranked page is topped up straight from PostgreSQL. Elasticsearch failure falls back to PostgreSQL's newest-first ordering: the same offers, unranked.

Changing a weight or a matrix cell affects the next search immediately. Use `ELASTICSEARCH_REINDEX_ON_STARTUP=true` only when an index mapping or an indexed field changes. Never express a hard eligibility or authorization rule in Elasticsearch alone: PostgreSQL is the source of truth.

### Production deployment

The Compose Elasticsearch service in `compose.yml` is deliberately **not** a production template. It is a single node with security disabled and port 9200 published to the host. Never deploy it as-is.

The VPS stack, `compose.prod.yml`, runs Elasticsearch this way (procedure in [docs/deploiement-vps.md](docs/deploiement-vps.md)):

1. **Private.** No port is published: only the backend reaches it, over the internal Docker network.
2. **Security on.** `xpack.security.enabled=true`, the `elastic` password lives in the GitHub `production` environment, never in the repository; `.github/workflows/ci-cd.yml` writes it into the server's `.env` at every deploy.
3. **Least-privilege API key.** The backend authenticates with `ELASTICSEARCH_API_KEY`, created once by `docker/elasticsearch/create-api-key.sh`. The key holds no cluster privilege and can only check, create, delete, read and write `rekr-offers-*`. The `elastic` superuser is used for that single call, never by the application. With `ELASTICSEARCH_API_KEY` left empty the client sends no credentials, which is what the local stack relies on.
4. **Index built from PostgreSQL.** Migrations run first, then the backend starts once with `ELASTICSEARCH_REINDEX_ON_STARTUP=true` to build `rekr-offers-v2`; the flag goes back to `false` for normal restarts. PostgreSQL is the source of truth, so rebuilding the index is always safe.

What this deployment does **not** do, knowingly, compared with Elastic's production guidance:

- **No TLS on HTTP traffic.** It never leaves the server's internal Docker network. TLS becomes mandatory the day Elasticsearch moves to another machine or a managed service.
- **Single node, no snapshot repository.** The index is disposable and rebuilt from PostgreSQL; losing it degrades the feed to PostgreSQL ordering, it loses no data.
- **No dedicated monitoring yet** beyond the backend's fallback warnings.

Keep the PostgreSQL eligibility recheck and fallback enabled in production. Elasticsearch only chooses the order of ids; it must never become the authority for authentication, likes, passes, matches, or offer visibility.
