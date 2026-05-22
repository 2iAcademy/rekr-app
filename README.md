# Rekr

Monorepo : `backend/` (NestJS) + `clientApp/` (React + Vite).

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
