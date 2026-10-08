# Runbook de panne — production Rekr

Ce document part d'un symptôme et donne les commandes pour le diagnostiquer, le corriger et vérifier que c'est
réparé. Il décrit la pile de `compose.prod.yml` déployée sur le VPS selon
[deploiement-vps.md](../deploiement-vps.md).

Les routes `/api/health` et `/api/health/search` arrivent avec la PR #228 : tant qu'elle n'est pas en production,
utiliser les commandes `docker compose` des fiches à la place.

Les messages `JWT_SECRET still holds the development value` et `must be at least 32` arrivent avec la PR #225.

Légende : ✅ commande vérifiée sur une pile `compose.prod.yml` locale · ⚠️ vérifiable en vraie production
seulement.

## 0. Repères

- Serveur : VPS Hetzner Cloud, Ubuntu, 2 Go de RAM, console de secours dans l'interface Hetzner.
- Accès : SSH par clé, compte nominatif avec `sudo`.
- `/opt/rekr` ne contient que `.env`, `compose.prod.yml` et `repo.git`, une copie Git sans fichiers de travail.
  Le serveur ne construit rien : il tire les images que la CI a poussées sur GHCR, taguées par commit. La version
  en service est la valeur `IMAGE_TAG` du `.env`.
- Ces fichiers appartiennent au compte `deploy`, qui déploie depuis GitHub Actions. **Toute commande Git sur le
  serveur passe par `sudo -u deploy git -C /opt/rekr/repo.git …`** : lancée depuis un compte nominatif, elle crée
  des fichiers que `deploy` ne peut plus remplacer, et le déploiement suivant échoue sur `Permission denied`.
- Toutes les commandes se lancent depuis `/opt/rekr`. Pour raccourcir :

```bash
cd /opt/rekr
alias dc='docker compose -f compose.prod.yml'
```

| Service         | Rôle                                  | Limite mémoire | Si il tombe                           |
| --------------- | ------------------------------------- | -------------- | ------------------------------------- |
| `caddy`         | HTTPS, sert le front, transmet `/api` | 128 Mo         | Site injoignable                      |
| `backend`       | API NestJS                            | 384 Mo         | Front affiché, `/api` en 502          |
| `migrate`       | Applique les migrations puis s'arrête | —              | Le backend ne démarre pas             |
| `postgres`      | Base de données                       | 256 Mo         | `/api` en 500, `/api/health` en 503   |
| `elasticsearch` | Classement du fil candidat            | 1200 Mo        | Fil trié par PostgreSQL, rien d'autre |

Où lire les erreurs : `dc logs` sur le serveur, et Sentry pour les exceptions du backend et du front.

### Changer une valeur du `.env`

Le `.env` du serveur est **réécrit à chaque déploiement**, depuis l'environnement GitHub `production` (voir
[deploiement-vps.md](../deploiement-vps.md)). Une valeur se change donc dans GitHub, jamais seulement sur le
serveur :

1. GitHub > Settings > Environments > `production` : modifier le secret ou la variable.
2. Actions > CI/CD > Run workflow, sur `main`, puis approuver le job Deploy. La CD réécrit le `.env` et recrée les conteneurs
   dont la configuration a changé. ⚠️

**En urgence, si GitHub est indisponible** : `sudo nano /opt/rekr/.env`, puis `dc up -d backend` (✅ pour
`dc up`). La modification ne tient que jusqu'au déploiement suivant : reporter la même valeur dans GitHub
aussitôt, sinon le prochain déploiement remet l'ancienne.

### ⛔ À ne jamais faire

- `dc down -v`, `docker volume prune`, `docker system prune --volumes` : effacent la base (`pg_data`), les CV
  (`backend_uploads`) et les certificats (`caddy_data`).
- Supprimer `caddy_data` : Let's Encrypt limite le nombre de certificats par semaine.
- Revenir à un ancien commit en pensant annuler une migration : le code recule, pas la base (fiche 6).

## 1. Triage en 2 minutes

```bash
curl -sI https://rekr.tech | head -1            # 1. le site répond ?
curl -s https://rekr.tech/api/health            # 2. l'API et PostgreSQL ?
curl -s https://rekr.tech/api/health/search     # 3. la recherche ?
dc ps -a                                        # 4. état des conteneurs (✅)
```

| Constat                                           | Fiche |
| ------------------------------------------------- | ----- |
| Pas de réponse, ou erreur TLS                     | 2     |
| Front OK, `/api/...` en 502                       | 3     |
| `/api/health` en 503                              | 4     |
| `/api/health` en 200, `/api/health/search` en 503 | 5     |
| `migrate` en `Exited (1)`                         | 6     |
| Conteneur qui redémarre en boucle, serveur lent   | 8     |
| Mot de passe oublié : e-mail jamais reçu          | 9     |

Pour savoir si un conteneur a été tué faute de mémoire ou redémarre en boucle (✅) :

```bash
for c in $(dc ps -aq); do
  docker inspect -f '{{.Name}} oom={{.State.OOMKilled}} restarts={{.RestartCount}} exit={{.State.ExitCode}}' "$c"
done
```

## 2. Le site ne répond plus

**Diagnostic**

1. Le serveur répond-il ? `ping rekr.tech`, puis SSH. Sans SSH : console Hetzner, le serveur est-il éteint ou en
   train de redémarrer ? ⚠️
2. Caddy tourne-t-il ? `dc ps caddy` puis `dc logs --tail 100 caddy` ✅
3. Erreur de certificat : chercher `acme`, `certificate` ou `rate limit` dans les logs de Caddy ⚠️
4. Le DNS pointe-t-il toujours sur le serveur ? `dig +short rekr.tech A` et `AAAA` ⚠️

**Remède**

- Serveur éteint : le rallumer depuis la console Hetzner. Les services ont `restart: unless-stopped` et
  repartent seuls. Ensuite, voir la fiche 5 : au redémarrage, le backend peut partir avant Elasticsearch.
- Caddy arrêté : `dc up -d caddy` ✅
- Certificat refusé pour cause de limite Let's Encrypt : attendre la fin de la fenêtre (une semaine au pire). Ne
  pas supprimer `caddy_data`, ça aggrave le problème. ⚠️

**Vérification** : `curl -sI https://rekr.tech` répond `200`, et `http://` redirige en `308` vers `https://` ✅

## 3. `/api` répond 502, ou le backend redémarre en boucle

Caddy ne joint pas le backend : il est arrêté, en train de redémarrer, ou n'a jamais démarré.

**Diagnostic**

```bash
dc ps -a backend migrate
dc logs --tail 200 backend
```

| Message dans les logs                                                                             | Cause                                 | Remède                                                                                  |
| ------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| `JWT_SECRET is required` / `JWT_SECRET still holds the development value` / `must be at least 32` | Secret vide, de dev ou trop court     | Nouveau `JWT_SECRET` (`openssl rand -base64 48`), voir « Changer une valeur du `.env` » |
| `SMTP_HOST is required in production`                                                             | SMTP absent                           | Renseigner les variables SMTP, voir « Changer une valeur du `.env` »                    |
| `... is required` au lancement de `dc up`                                                         | Variable obligatoire vide dans `.env` | La compléter dans GitHub (`.env.prod.example` les liste)                                |
| `oom=true` dans le triage                                                                         | Plus de 384 Mo                        | Fiche 8                                                                                 |
| Le backend n'est même pas créé, `migrate` en `Exited (1)`                                         | Migration en échec                    | Fiche 6                                                                                 |

Une variable obligatoire manquante dans GitHub arrête la CD avant le serveur, à l'étape « Check the production
settings » : le message nomme toutes celles qui manquent. Après correction en urgence du `.env` :
`dc up -d backend` ✅ (compose recrée le conteneur si sa configuration a changé).

**Vérification** : `curl -s https://rekr.tech/api/auth/me` répond `401` en JSON (✅), et `/api/health` en `200`.

## 4. `/api/health` en 503 : PostgreSQL

Toute l'application est touchée : connexion, inscription, profils, fil.

**Diagnostic**

```bash
dc ps postgres
dc exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'   # ✅
dc logs --tail 100 postgres
df -h /                                                                        # disque plein ?
```

**Remède**

- Conteneur arrêté : `dc up -d postgres` ✅. Le backend se reconnecte seul.
- `No space left on device` dans les logs : fiche 8, avant toute autre chose.
- `oom=true` : PostgreSQL a dépassé 256 Mo. Relancer, puis chercher la requête en cause dans Sentry.
- Les logs du backend disent `PrismaClientKnownRequestError P2010` ou `ECONNREFUSED` : c'est la conséquence, pas
  la cause. Regarder PostgreSQL.

**Vérification** : `pg_isready` répond `accepting connections` (✅) et `/api/health` répond `200`.

## 5. `/api/health/search` en 503 : Elasticsearch

**Ce n'est pas une panne du site.** Le fil candidat continue de marcher, trié par PostgreSQL au lieu du
classement par pertinence. Le backend l'écrit dans ses logs : `candidate feeds will use PostgreSQL ordering`.

**Diagnostic**

```bash
dc ps elasticsearch
dc logs --tail 100 elasticsearch
# Santé du cluster et présence de l'index (✅)
dc exec -T elasticsearch sh -c \
  'curl -sS -u "elastic:$ELASTIC_PASSWORD" "http://localhost:9200/_cluster/health?filter_path=status"'
dc exec -T elasticsearch sh -c \
  'curl -sS -u "elastic:$ELASTIC_PASSWORD" "http://localhost:9200/_cat/indices/rekr-offers-*?h=index,docs.count"'
# La clé du backend est-elle acceptée ? 200 attendu, 401 = clé invalide (✅)
dc exec -T backend node -e 'fetch("http://elasticsearch:9200/rekr-offers-v2/_count",
  {headers:{Authorization:"ApiKey "+process.env.ELASTICSEARCH_API_KEY}}).then(r=>console.log(r.status))'
```

| Constat                                                                          | Remède                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Conteneur arrêté, ou `oom=true` (plus de 1200 Mo)                                | `dc up -d elasticsearch`, puis redémarrer le backend (ci-dessous)                            |
| Démarre puis s'arrête, `max virtual memory areas` dans les logs                  | `vm.max_map_count` perdu : voir les prérequis de [deploiement-vps.md](../deploiement-vps.md) |
| Cluster `green`/`yellow`, index absent (`_cat/indices` vide)                     | Reconstruire l'index (ci-dessous)                                                            |
| La clé répond `401`                                                              | Recréer la clé (ci-dessous)                                                                  |
| Tout est vert, mais le backend logue `Elasticsearch is unavailable` au démarrage | Il a démarré avant Elasticsearch : `dc restart backend`                                      |

Le dernier cas est le plus probable après un redémarrage du serveur. `depends_on` attend qu'Elasticsearch soit
lancé, pas qu'il soit prêt. Si le backend démarre avant, il ne crée pas l'index et reste sur le tri PostgreSQL
jusqu'à son prochain redémarrage. Constaté sur la pile locale au premier démarrage (✅).

**Reconstruire l'index** : PostgreSQL est la source de vérité, reconstruire ne perd rien. Actions > CI/CD >
Run workflow, en cochant « Reconstruire l'index Elasticsearch », puis approuver. Le déploiement suivant repart
sans la case, donc sans reconstruction. ⚠️

En urgence, sans GitHub (✅) :

```bash
# sudo nano .env : ELASTICSEARCH_REINDEX_ON_STARTUP='true'
dc up -d backend
# une fois l'index reconstruit (logs du backend, ou _cat/indices) : remettre 'false'
dc up -d backend
```

**Recréer la clé du backend** (✅) :

```bash
sudo -u deploy git -C repo.git show main:docker/elasticsearch/create-api-key.sh | sh   # affiche la nouvelle clé
```

La coller dans le secret GitHub `ELASTICSEARCH_API_KEY`, puis Actions > CI/CD > Run workflow (voir « Changer une
valeur du `.env` »).

Puis invalider l'ancienne clé (`DELETE /_security/api_key` avec son id, voir le script).

**Limite connue** : une offre créée ou fermée pendant la panne n'est pas rattrapée quand Elasticsearch revient
(#227). Après une panne longue, reconstruire l'index.

**Vérification** : `/api/health/search` répond `200`, et `_cat/indices` montre `rekr-offers-v2` avec autant de
documents que d'offres ouvertes.

## 6. Une migration échoue au déploiement

`migrate` s'arrête en erreur, et le backend, qui attend sa réussite, ne démarre pas.

**Diagnostic**

```bash
dc ps -a migrate
dc logs migrate
```

**Remède**

- Erreur de connexion (`P1001`) : la base n'était pas prête ou le mot de passe a changé. Fiche 4, puis
  `dc up -d`.
- Migration en échec à mi-chemin (`P3018`, `P3009`) : Prisma la marque `failed` et refuse d'aller plus loin.
  1. Lire l'erreur SQL dans `dc logs migrate`.
  2. Corriger la base à la main **ou** livrer un correctif de la migration. Ne jamais modifier une migration
     déjà appliquée ailleurs.
  3. Indiquer à Prisma ce qui a été fait (non testé en local) :

     ```bash
     dc run --rm migrate npx prisma migrate resolve --rolled-back <nom_de_la_migration>   # à rejouer
     dc run --rm migrate npx prisma migrate resolve --applied <nom_de_la_migration>       # faite à la main
     ```

  4. `dc up -d`.
- Avant toute manipulation de la base : une sauvegarde (fiche 11). ⚠️

**Vérification** : `dc ps -a migrate` montre `Exited (0)`, et le backend est `running`.

## 7. Revenir à la version précédente

**La voie normale est un revert sur `main`** : une PR qui annule le merge fautif, mergée puis déployée par la CD.
Le lancement manuel de la CD déploie toujours le dernier commit de `main`, jamais un commit plus ancien.

**En urgence**, le temps que le revert passe, directement sur le serveur. Chaque version reste sur GHCR sous
le hash de son commit : revenir en arrière, c'est remettre l'ancien hash dans `IMAGE_TAG`, sans rien
reconstruire (✅ en local).

```bash
cd /opt/rekr
sudo -u deploy git -C repo.git log --format='%H %s' -5 main   # repérer le commit qui marchait
sudo sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG='<hash complet>'/" .env
dc up -d --no-build
```

`compose.prod.yml` reste celui de la version fautive. S'il a changé entre les deux versions, le reprendre aussi :
`sudo -u deploy git -C repo.git show <hash>:compose.prod.yml | sudo -u deploy tee compose.prod.yml >/dev/null`.

**Ce retour ne touche que le code.** Si la version fautive a appliqué une migration, la base reste dans son
nouvel état. Ça marche si la migration ne fait qu'ajouter (colonne, table) : l'ancien code l'ignore. Si elle
renomme ou supprime, l'ancien code plante, et il faut soit écrire une migration inverse, soit restaurer la
sauvegarde d'avant le déploiement (fiche 11, avec perte des données écrites depuis).

Le serveur reste sur cette version jusqu'au déploiement suivant, qui réécrit `IMAGE_TAG`. N'approuver ce déploiement
qu'une fois le revert ou le correctif mergé.

## 8. Disque plein, mémoire saturée

**Diagnostic**

```bash
df -h /
docker system df                     # images, conteneurs, volumes, cache de build (✅)
free -m
docker stats --no-stream             # mémoire de chaque conteneur face à sa limite (✅)
```

Au repos, sur la pile locale : Elasticsearch environ 890 Mo, backend 120 Mo, PostgreSQL 30 Mo, Caddy 20 Mo (✅).

**Remède**

- Disque : supprimer ce qui se reconstruit, jamais les volumes.

  ```bash
  docker image prune -a              # images non utilisées par un conteneur
  docker builder prune               # cache de build
  ```

  Les journaux des conteneurs sont plafonnés à 3 × 10 Mo par `/etc/docker/daemon.json`. S'ils grossissent, ce
  réglage a été perdu.

- Mémoire : un conteneur `oom=true` a dépassé sa limite, et Docker l'a relancé. Si ça se répète, chercher la
  cause (requête, fuite) avant de monter la limite. Le total doit tenir dans 2 Go, swap compris.

**Vérification** : `df -h /` sous 80 %, plus aucun `oom=true` dans le triage.

## 9. Les e-mails ne partent plus

Symptôme : « mot de passe oublié » ne reçoit rien. L'API répond pareil qu'un e-mail parte ou non, pour ne pas
révéler quels comptes existent.

**Diagnostic**

```bash
dc logs --tail 200 backend | grep -iE 'smtp|mail'
```

- `ECONNREFUSED`, `ETIMEDOUT` sur le port 587 : réseau ou Brevo indisponible. Hetzner bloque 25 et 465 en
  sortie, il faut rester sur 587. ⚠️
- `535`, `authentication failed` : identifiants Brevo invalides ou révoqués. ⚠️
- Rien dans les logs, rien reçu : regarder les spams et le tableau de bord Brevo (DKIM, DMARC, quota). ⚠️

**Remède** : corriger les `SMTP_*` dans GitHub, voir « Changer une valeur du `.env` ».

**Vérification** : demander un lien de réinitialisation pour son propre compte et le recevoir. ⚠️

## 10. Un secret a fuité

Toujours : changer la valeur dans l'environnement GitHub `production`, redéployer (« Changer une valeur du
`.env` »), invalider l'ancienne côté fournisseur, puis noter l'incident (fiche 12). Générer chaque nouvelle
valeur sans l'afficher : `openssl rand -hex 24 | tr -d '\n' | pbcopy`, ou `-base64 48` pour `JWT_SECRET`.

| Secret                  | Procédure                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`            | Nouveau secret GitHub, redéployer (✅ pour l'effet). Voir l'encadré ci-dessous.                   |
| `POSTGRES_PASSWORD`     | D'abord dans la base, ensuite le secret GitHub, puis redéployer (✅) : voir ci-dessous.           |
| `ELASTICSEARCH_API_KEY` | Recréer la clé (fiche 5), puis invalider l'ancienne.                                              |
| `ELASTIC_PASSWORD`      | `bin/elasticsearch-reset-password -u elastic -i` dans le conteneur, puis le secret GitHub. ⚠️     |
| `SMTP_PASSWORD`         | Révoquer la clé SMTP dans Brevo, en créer une, secret GitHub, redéployer. ⚠️                      |
| `STREAM_API_SECRET`     | Régénérer le secret de l'app Stream de production (API keys), secret GitHub, redéployer. ⚠️       |
| `DEPLOY_SSH_KEY`        | Nouvelle paire, remplacer la ligne de `/home/deploy/.ssh/authorized_keys` et le secret GitHub. ⚠️ |

**`JWT_SECRET` ne déconnecte pas les utilisateurs.** Les jetons d'accès signés avec l'ancien secret sont refusés
(✅), mais la session continue : le navigateur obtient un nouveau jeton avec son refresh token, qui est une valeur
aléatoire stockée en base, indépendante du secret (✅). Pour forcer tout le monde à se reconnecter, révoquer
aussi les refresh tokens (✅) :

```bash
dc exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE refresh_token SET revoked_at = now() WHERE revoked_at IS NULL"'
```

**`POSTGRES_PASSWORD`** : la variable du conteneur ne sert qu'à la création initiale de la base. La changer
dans `.env` seule casse la connexion du backend.

```bash
dc exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
# dans psql : \password   (demande le nouveau mot de passe sans l'afficher), puis \q
```

Ensuite, remplacer le secret GitHub `POSTGRES_PASSWORD` par la même valeur et redéployer. Entre les deux, le
backend en cours garde sa connexion ouverte ; un redémarrage avant le redéploiement échouerait.

Vérifié avec `ALTER USER ... WITH PASSWORD` puis le nouveau mot de passe dans `.env` et `dc up -d` : backend et
`migrate` recréés, connexion en `200` (✅). La CD fait cette même écriture du `.env` suivie de `dc up`.
`\password` fait la même chose qu'`ALTER USER` sans laisser le mot de passe dans l'historique du shell.

## 11. Restaurer une sauvegarde

La sauvegarde, c'est **toujours deux fichiers** : le dump PostgreSQL et l'archive du volume `backend_uploads`,
faits chaque nuit par `rekr-backup` dans `/var/backups/rekr/` (voir [deploiement-vps.md](../deploiement-vps.md#sauvegarder)).
L'un sans l'autre laisse des lignes qui pointent vers des fichiers absents.

**Avant de restaurer**, vérifier que la sauvegarde choisie se restaure, sans toucher à la production :

```bash
sudo ls /var/backups/rekr/                 # choisir l'horodatage, par exemple 20261009-031500
sudo rekr-restore-test 20261009-031500
```

Procédure vérifiée sur la pile locale : base supprimée puis restaurée, compte de test retrouvé et connexion en
`200`, archive des uploads extraite et lisible (✅). L'extraction a été testée dans un dossier temporaire, pas
dans le volume `backend_uploads` lui-même :

```bash
dc stop backend caddy                                     # plus personne n'écrit
dc exec -T postgres sh -c \
  'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
sudo cat /var/backups/rekr/db-<horodatage>.dump | \
  dc exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner'
sudo cat /var/backups/rekr/uploads-<horodatage>.tar.gz | \
  docker run --rm -i -v rekr_backend_uploads:/data alpine tar xzf - -C /data
dc up -d
```

Puis reconstruire l'index Elasticsearch (fiche 5) : il reflète la base d'avant la restauration.

`rekr-restore-test` prouve qu'une sauvegarde réelle se restaure dans une base jetable. La restauration complète
ci-dessus, qui remplace la base de production, n'a été jouée que sur la pile locale. ⚠️

**Vérification** : nombre de lignes de `"user"` et `offer` conforme à la date du dump, connexion d'un compte
connu, un CV s'ouvre.

## 12. Après l'incident

À écrire dans les 48 heures, dans `docs/ops/incidents/AAAA-MM-JJ-<sujet>.md` :

```markdown
# <Titre court>

- **Quand** : début, détection, fin (heures)
- **Impact** : qui a été touché, et comment
- **Cause** : ce qui a cassé, et pourquoi
- **Remède** : ce qui a été fait, avec les commandes
- **Pour que ça ne revienne pas** : actions, avec un ticket chacune
```

Si une fiche de ce runbook était fausse ou manquait, la corriger dans la même PR.
