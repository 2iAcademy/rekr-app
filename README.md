# Rekr

Monorepo : `backend/` (NestJS + Prisma + PostgreSQL) + `clientApp/` (React + Vite).

## Stack

| Dossier       | Contenu                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| `backend/`    | API NestJS 11 (TypeScript) · ORM **Prisma 7** · PostgreSQL 18 · Kafka producer |
| `clientApp/`  | Front React + Vite                                                             |
| `compose.yml` | Stack locale : PostgreSQL, backend, frontend                                   |

## Démarrage

### Prérequis

- Docker + Docker Compose
- Node.js 20+ (pour lancer les commandes Prisma depuis l'hôte)

### 1. Variables d'environnement

```bash
cp .env.example .env                  # creds PostgreSQL (racine → utilisés par docker-compose)
cp backend/.env.example backend/.env  # DATABASE_URL + PORT (utilisés par NestJS / Prisma)
```

⚠️ Les identifiants Postgres de `.env` (racine) et le `DATABASE_URL` de `backend/.env` doivent être cohérents.

### 2. Lancer la stack

```bash
docker compose up -d
```

Démarre `postgres` (5432), `kafka` (29092), `kafka-ui` (8085), `backend` (3001), `logs-sink` et `frontend` (8080).

### Kafka / logs

Flux: `backend` (producer) → topic Kafka `logs.raw` → `logs-sink` (consumer) → table Postgres `logs_raw`.

1. Vérifier que les services tournent:

```bash
docker compose ps
docker compose logs -f backend logs-sink
```

2. Produire un message de test (depuis le conteneur backend, fonctionne même si `localhost:3001` n'est pas joignable depuis l'hôte):

```bash
docker compose exec backend sh -lc "wget -qSO- --post-data='' http://127.0.0.1:3001/api/logs/sample 2>&1"
```

3. Variante erreur simulée:

```bash
docker compose exec backend sh -lc "wget -qSO- --header='Content-Type: application/json' --post-data='{\"message\":\"test error\"}' http://127.0.0.1:3001/api/logs/error 2>&1"
```

4. Vérifier la consommation:

```bash
docker compose logs -f logs-sink
```

5. Vérifier côté Kafka UI: http://localhost:8085

6. Vérifier la persistance en base:

```bash
docker compose exec postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-postgres} -c "SELECT event_id, level, message, occurred_at FROM logs_raw ORDER BY created_at DESC LIMIT 10;"
```

### 3. Initialiser la base (depuis l'hôte)

```bash
cd backend
npm install
npx prisma migrate dev   # crée et applique les migrations
npx prisma generate      # génère le client Prisma
```

L'API répond sur le réseau Docker à `http://backend:3001/api`.
Depuis l'hôte, l'URL exposée est `http://localhost:3001/api` si le port forwarding Docker est disponible.
Documentation Swagger: `http://localhost:3001/api/docs` (OpenAPI JSON: `http://localhost:3001/api/docs-json`).

## Authentification (signup / login)

Le backend expose:

- `POST /api/auth/signup`
- `POST /api/auth/login`

Variables requises dans `backend/.env`:

```bash
JWT_SECRET="<secret-long-et-aleatoire>"
```

Payloads:

- `signup`: `{ "email": "user@mail.com", "password": "min8chars", "userType": "candidate" | "recruiter" }`
- `login`: `{ "email": "user@mail.com", "password": "min8chars" }`

La réponse contient `accessToken` + un objet `user` (sans mot de passe).

## Base de données — Prisma

Le schéma vit dans `backend/prisma/schema.prisma`. Toutes les commandes se lancent depuis `backend/`.

```bash
npx prisma migrate dev --name <description>  # modifier le schéma → nouvelle migration (dev)
npx prisma generate                          # régénérer le client après un changement de schéma
npx prisma studio                            # explorer les données dans le navigateur
```

- Les migrations se lancent **depuis l'hôte**, connectées à `localhost:5432`. En production : `npx prisma migrate deploy`.
- **Prisma 7** : le client est généré en CommonJS (`moduleFormat = "cjs"` dans le bloc `generator`) pour rester compatible avec NestJS.

## Ajouter une dépendance npm au backend

Le conteneur `backend` a son **propre** `node_modules` (volume anonyme). Après une nouvelle dépendance, il faut rebuild l'image **et** renouveler ce volume :

```bash
npm --prefix backend install <paquet>
docker compose up -d --build --renew-anon-volumes backend
```

> Un `docker compose up --build` seul ne suffit pas : l'ancien volume `node_modules` masque la nouvelle image. `--renew-anon-volumes` est indispensable.

## Checks qualité

Le workflow `CI Backend` (job `Lint`) et le workflow `CI Frontend` (job `Lint`) vérifient le code sur chaque pull request. Pour les rejouer en local :

|                    | Backend (`backend/`)                 | Frontend (`clientApp/`)                  |
| ------------------ | ------------------------------------ | ---------------------------------------- |
| Vérifier           | `npm run lint:check`                 | `npm run lint`                           |
| Vérifier le format | `npm run format:check`               | `npm run format:check`                   |
| Corriger           | `npm run lint` puis `npm run format` | `npm run lint:fix` puis `npm run format` |

Les variantes `lint` (backend) et `lint:fix` (frontend) **corrigent** les fichiers : elles ne servent pas de vérification. En CI, seules les commandes `:check` sont utilisées.

Les fins de ligne sont normalisées en LF via `.gitattributes` : ESLint tolère les CRLF (`endOfLine: "auto"`), mais `prettier --check` les rejette.

## Analyse de code — SonarQube Cloud

L'analyse tourne en CI, sur [SonarQube Cloud](https://sonarcloud.io) (gratuit : le repo est public). Le workflow `CI Sonar` produit les couvertures backend et frontend, puis lance une analyse unique pour tout le monorepo.

### Configuration

Deux secrets de dépôt sont requis (**Settings → Secrets and variables → Actions**) :

| Secret           | Valeur                                                       |
| ---------------- | ------------------------------------------------------------ |
| `SONAR_TOKEN`    | token généré sur SonarQube Cloud (**My Account → Security**) |
| `SONAR_HOST_URL` | `https://sonarcloud.io`                                      |

Tant que l'un des deux manque, le job se contente d'émettre une notice et passe — la CI ne devient pas rouge pour autant.

La configuration du projet vit dans `sonar-project.properties` à la racine : `sonar.projectKey` et `sonar.organization` doivent correspondre à ceux affichés sur le dashboard Cloud.

### Couverture

`sonar.javascript.lcov.reportPaths` lit `backend/coverage/lcov.info` et `clientApp/coverage/lcov.info`, produits par `npm run test:cov` dans chaque dossier.

### Scan en local (facultatif)

Il n'y a plus d'instance auto-hébergée : le scan local vise directement Cloud.

```bash
SONAR_TOKEN=<token> docker run --rm -e SONAR_TOKEN -e SONAR_HOST_URL=https://sonarcloud.io -v "$PWD:/usr/src" sonarsource/sonar-scanner-cli
```

Lancer les tests avec couverture avant le scan, sinon l'analyse remonte 0 %.

## Elasticsearch candidate-feed ranking

The local Compose stack includes Elasticsearch at `http://localhost:9200`. It is a development-only single node with Elastic security disabled; do not copy that setting to production.

The backend indexes open offers and uses Elasticsearch only to rank candidate-feed offer ids. PostgreSQL rechecks that every returned offer is still open and has not already been liked or passed, then reads the card data. If Elasticsearch is disabled or unavailable, the feed safely falls back to the existing newest-first PostgreSQL ordering.

The ranking weights are intentionally explicit and all live in `backend/src/search/ranking/ranking-rules.ts`: skills 5, seniority 4, contract type 3, salary 3, location 1, freshness 1. Remote work carries no weight — it excludes only. **[docs/ranking-du-feed-candidat.md](docs/ranking-du-feed-candidat.md) explains what filters, what ranks, and why**, with a worked trace. Set `ELASTICSEARCH_ENABLED=false` to force the fallback, override `ELASTICSEARCH_NODE` for another secured cluster, or set `ELASTICSEARCH_REINDEX_ON_STARTUP=true` for a deliberate rebuild from PostgreSQL.

### How candidate-feed ranking works

Two mechanisms, deliberately kept apart. A **filter** removes an offer from the deck: the trade, a remote arrangement the candidate cannot hold, and the single contract pair that is a status rather than a preference (apprenticeship/internship against everything else). A **weight** orders what is left, and never subtracts — an offer that left a field empty earns nothing on it rather than being pushed down.

Every number is in `backend/src/search/ranking/ranking-rules.ts`, including the three affinity matrices. The builder beside it, `offer-ranking.ts`, only turns them into a query and holds no value of its own; it is pure, so `offer-ranking.spec.ts` asserts the whole ranking without a cluster. **To change the ranking, edit a number in `ranking-rules.ts` — not the builder.**

After Elasticsearch returns ranked ids, PostgreSQL re-applies the hard eligibility rules: the offer must be open, must pass the same trade/remote/contract exclusions, and must not already be liked or passed. This prevents a delayed search index from exposing an ineligible card, and it is why the exclusions are exported (`allowedContractTypes`, `allowedRemotePolicies`) rather than expressed in the query alone — the ranked page is topped up straight from PostgreSQL. Elasticsearch failure falls back to PostgreSQL's newest-first ordering: the same offers, unranked.

Changing a weight or a matrix cell affects the next search immediately. Use `ELASTICSEARCH_REINDEX_ON_STARTUP=true` only when an index mapping or an indexed field changes. Never express a hard eligibility or authorization rule in Elasticsearch alone: PostgreSQL is the source of truth.

### Production deployment

The Compose Elasticsearch service is deliberately **not** a production template. It is a single node with security disabled and port 9200 published to the host. Never deploy it as-is.

Before enabling Elasticsearch in staging or production:

1. Prefer a managed Elastic deployment. It provides node orchestration, TLS, authentication, backups, and monitoring. For self-managed Elasticsearch, run at least a resilient multi-node cluster with persistent storage and a tested snapshot repository.
2. Keep Elasticsearch private: do not publish port 9200 to the public internet. Allow access only from the backend network and authorised operational tooling.
3. Enable Elastic security and TLS for both HTTP client traffic and node-to-node traffic. Use a least-privilege Elasticsearch API key for the backend; do not use the `elastic` superuser or store passwords in the repository.
4. Add the API-key and CA-certificate settings to the backend deployment secrets before setting `ELASTICSEARCH_ENABLED=true`. The current code accepts `ELASTICSEARCH_NODE` only, so production enablement is blocked until the client is extended to read those secrets and authenticate over HTTPS.
5. Run Prisma migrations against PostgreSQL first. Then deploy the backend with `ELASTICSEARCH_REINDEX_ON_STARTUP=true` exactly once to build `rekr-offers-v2`; remove that flag for normal restarts. PostgreSQL is the source of truth and rebuilding the index must always be safe.
6. Monitor cluster health, disk watermarks, indexing failures, search latency, and backend fallback warnings. Configure snapshots and practise restoring them. Kibana is optional but useful for these operational tasks.

Keep the PostgreSQL eligibility recheck and fallback enabled in production. Elasticsearch only chooses the order of ids; it must never become the authority for authentication, likes, passes, matches, or offer visibility.

Elastic's production guidance covers resilience, snapshots, and monitoring. Its security guidance requires security to remain enabled and recommends TLS plus restricted network access.
