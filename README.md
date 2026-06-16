# Rekr

Monorepo : `backend/` (NestJS + Prisma + PostgreSQL) + `clientApp/` (React + Vite).

## Stack

| Dossier | Contenu |
|---------|---------|
| `backend/` | API NestJS 11 (TypeScript) · ORM **Prisma 7** · PostgreSQL 18 |
| `clientApp/` | Front React + Vite |
| `sonarqube/` | Analyse de code en local |

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

Démarre `postgres` (5432), `backend` (3001) et `frontend` (8080).

### 3. Initialiser la base (depuis l'hôte)

```bash
cd backend
npm install
npx prisma migrate dev   # crée et applique les migrations
npx prisma generate      # génère le client Prisma
```

L'API répond alors sur **http://localhost:3001/api**.

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
