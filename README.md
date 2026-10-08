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

### 1. Lancer la stack

```bash
docker compose up -d
```

Aucun `.env` n'est nécessaire : `compose.yml` fournit des valeurs de dev par défaut (base, `JWT_SECRET` jetable) et
le backend applique les migrations Prisma à chaque démarrage du conteneur.

Démarre `postgres` (5432), `elasticsearch` (9200), `backend` (3001) et `frontend` (8080). L'API répond sur
`http://localhost:3001/api`, Swagger sur `http://localhost:3001/api/docs`.

### 2. Personnaliser (facultatif)

```bash
cp .env.example .env                  # surcharge les valeurs de compose.yml (ports, SMTP, Sentry...)
cp backend/.env.example backend/.env  # pour les commandes lancées depuis l'hôte (CLI Prisma, Prisma Studio)
```

⚠️ Les identifiants Postgres de `.env` (racine) et le `DATABASE_URL` de `backend/.env` doivent être cohérents.

Le `JWT_SECRET` de dev est public : l'API refuse de démarrer avec lui, ou avec un secret de moins de 32 caractères,
quand `NODE_ENV=production`.

### Kafka / logs

Flux: `backend` (producer) → topic Kafka `logs.raw` → `logs-sink` (consumer) → table Postgres `logs_raw`.

Cette chaîne a sa propre pile, `docker/docker-compose.yml`, séparée du `compose.yml` racine. Les commandes ci-dessous se lancent depuis la racine du dépôt.

1. Démarrer Kafka, Kafka UI et Postgres, puis appliquer les migrations **avant** `logs-sink`. Sinon `logs-sink` crée `logs_raw` dans une base vide et `prisma migrate deploy` refuse ensuite de migrer (P3005).

```bash
export JWT_SECRET="<secret-long-et-aleatoire>"   # l'API refuse de démarrer sans
docker compose -f docker/docker-compose.yml up -d --build kafka kafka-ui postgres backend
docker compose -f docker/docker-compose.yml exec backend npx prisma migrate deploy
docker compose -f docker/docker-compose.yml up -d logs-sink
```

Si le port 5432 est déjà pris sur l'hôte, préfixer par `POSTGRES_PORT=55433`. Elasticsearch n'est pas dans cette pile : le backend y tourne avec `ELASTICSEARCH_ENABLED=false`.

2. Obtenir un jeton administrateur. `/api/logs/*` est réservé au type `admin`, qui ne s'obtient pas à l'inscription : créer un compte, le passer en admin en base, puis se connecter.

```bash
curl -s -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.localhost","password":"<mot-de-passe>","userType":"candidate","acceptTerms":true}' \
  http://localhost:3001/api/auth/signup
docker compose -f docker/docker-compose.yml exec postgres psql -U ${POSTGRES_USER:-user} -d ${POSTGRES_DB:-backend} \
  -c "UPDATE \"user\" SET user_type='admin', role='admin' WHERE email='admin@test.localhost';"
TOKEN=$(curl -s -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.localhost","password":"<mot-de-passe>"}' \
  http://localhost:3001/api/auth/login | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
```

3. Produire un message de test, puis une erreur simulée:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/logs/sample
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"test error"}' http://localhost:3001/api/logs/error
```

4. Vérifier la consommation:

```bash
docker compose -f docker/docker-compose.yml logs -f logs-sink
```

5. Vérifier côté Kafka UI: http://localhost:8085 (topic `logs.raw`, onglet Messages).

6. Vérifier la persistance en base:

```bash
docker compose -f docker/docker-compose.yml exec postgres psql -U ${POSTGRES_USER:-user} -d ${POSTGRES_DB:-backend} -c "SELECT event_id, level, message, occurred_at FROM logs_raw ORDER BY created_at DESC LIMIT 10;"
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

## Messagerie — Stream Chat

Les messages entre un candidat et son match sont stockés chez [Stream](https://getstream.io/chat/). L'API décide de l'accès : `POST /api/chat/token` signe un jeton Stream d'une heure, `POST /api/matches/:id/chat` ouvre la conversation du match une fois l'appelant reconnu (le candidat, ou un recruteur de l'entreprise de l'offre). Chaque ouverture remet le channel en ordre : créé par l'utilisateur système `rekr-system`, sans membre étranger au match, gelé si l'offre n'est plus publiée.

Variables (racine `.env` pour docker compose, `backend/.env` hors Docker) :

```bash
STREAM_API_KEY=""     # dashboard.getstream.io > <app> > Overview > App Access Keys
STREAM_API_SECRET=""  # idem ; reste côté backend, jamais dans une variable VITE_
```

Sans ces clés l'API démarre, et seules les routes de messagerie répondent 503.

Réglages attendus dans le dashboard de l'app Stream, à reporter sur chaque environnement. Le code ne dépend pas d'eux pour décider qui entre dans une conversation, mais ils ferment ce qu'un jeton client pourrait faire en appelant Stream directement :

- type de channel `messaging`, rôle `user` et `channel_member` : pas de création de channel, pas de modification des membres, pas de mise à jour du channel (donc pas de dégel) ;
- type de channel `messaging` : uploads désactivés ;
- réglages de l'app : recherche d'utilisateurs interdite au rôle `user` (`user_search_disallowed_roles`) ;
- rôle `user` : pas de modification de son propre profil (le nom affiché vient de l'API) ;
- région de stockage : UE.

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
