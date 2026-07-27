# Rekr

Monorepo : `backend/` (NestJS + Prisma + PostgreSQL) + `clientApp/` (React + Vite).

## Stack

| Dossier | Contenu |
|---------|---------|
| `backend/` | API NestJS 11 (TypeScript) · ORM **Prisma 7** · PostgreSQL 18 · Kafka producer |
| `clientApp/` | Front React + Vite |
| `sonarqube/` | Analyse de code en local |
| `docker-compose.yml` | Stack locale avec PostgreSQL, Kafka, Kafka UI, backend, sink |

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

## Analyse de code — SonarQube en local

### Premier démarrage

```bash
cd sonarqube
cp .env.example .env
# Renseigne SONAR_DB_USER / SONAR_DB_PASSWORD dans .env
docker compose up -d
```

SonarQube met ~1 à 2 minutes à démarrer. Accessible ensuite sur http://localhost:9000 (login initial `admin` / `admin`, mot de passe à changer au premier login).

### Lancer un scan du projet

1. Dans l'UI SonarQube : **My Account → Security → Generate Tokens**, créer un token.
2. Le placer dans `sonarqube/.env` dans la variable `SONAR_TOKEN`.
3. Depuis `sonarqube/` :

```bash
docker compose --profile scan run --rm scanner
```

Le scanner lit `sonar-project.properties` à la racine du repo et pousse le rapport vers l'instance locale.

### Arrêter / nettoyer

```bash
cd sonarqube
docker compose down        # stoppe, conserve les données
docker compose down -v     # stoppe et wipe les volumes (reset complet)
```
