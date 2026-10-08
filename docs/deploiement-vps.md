# Déploiement sur le VPS

Rekr tourne en production sur un VPS Hetzner Cloud (Ubuntu 26.04 LTS, 2 Go de
RAM), derrière le domaine `rekr.tech`. La pile est décrite par
`compose.prod.yml` ; `compose.yml` reste réservé au développement.

| Service         | Rôle                                                               | Exposé sur Internet |
| --------------- | ------------------------------------------------------------------ | ------------------- |
| `caddy`         | Sert le front (build Vite), transmet `/api` au backend, gère HTTPS | oui : 80 et 443     |
| `backend`       | API NestJS (image `runner`)                                        | non                 |
| `migrate`       | Applique les migrations Prisma, puis s'arrête                      | non                 |
| `postgres`      | Base de données                                                    | non                 |
| `elasticsearch` | Classement du fil candidat, sécurité activée                       | non                 |

## Prérequis sur le serveur

Déjà en place, à refaire seulement sur un nouveau serveur :

- accès SSH par clé uniquement, comptes nominatifs avec `sudo`, root fermé ;
- pare-feu Hetzner : entrées 22, 80, 443 et ICMP seulement ;
- Docker et Docker Compose depuis le dépôt officiel, comptes dans le groupe
  `docker` ;
- enregistrements DNS `A` et `AAAA` de `rekr.tech` vers le serveur.

Pour Elasticsearch, un réglage système et un swap :

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
echo 'vm.max_map_count=262144' | sudo tee /etc/sysctl.d/99-elasticsearch.conf
sudo sysctl --system
```

Et une limite à la taille des journaux des conteneurs :

```bash
sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
EOF
sudo systemctl restart docker
```

## Comment se fait un déploiement

Un seul workflow, `.github/workflows/ci-cd.yml`, fait la CI et la CD, en une
seule exécution :

1. **CI** (à chaque PR, sur `preprod` et sur `main`) : build, lint et tests du
   backend et du front, puis analyse Sonar. « Backend CI » et « Frontend CI »
   sont les contrôles obligatoires des PR.
2. **Images** (sur `main` uniquement, une fois la CI verte) : construit trois
   images et les pousse sur GHCR, taguées avec le hash du commit
   (`scripts/ci/build-images.sh`) :
   - `rekr-backend` : l'API ;
   - `rekr-migrate` : les migrations Prisma ;
   - `rekr-web` : Caddy, avec le front et le `Caddyfile` dedans.
3. **Deploy** : attend l'approbation de Julien ou de Diego (environnement
   GitHub `production`). C'est la seule étape manuelle, et elle n'est proposée
   que si tout ce qui précède a réussi. Ensuite :
   - vérifie que le commit est toujours le dernier de `main` : une approbation
     tardive sur un ancien run ne remet pas une vieille version en service ;
   - génère le `.env` depuis les secrets et variables de `production`
     (`scripts/ci/render-env.sh`), en refusant de partir s'il en manque un ;
   - l'envoie en SSH au compte `deploy`, dont la clé ne peut lancer que
     `/usr/local/bin/rekr-deploy`.
4. **Smoke test** : vérifie que `https://rekr.tech/api/health` répond 200.

Sur le serveur, `rekr-deploy` :

- vérifie que le commit est sur `main` ;
- prend `compose.prod.yml` dans ce commit ;
- écrit le `.env` reçu, en fixant lui-même `IMAGE_TAG` au hash du commit ;
- tire les images, avec le jeton du job Deploy (voir ci-dessous) ;
- seulement si toutes sont là, remplace les fichiers et lance
  `docker compose up -d --no-build`.

Le serveur ne construit rien et n'a pas le code source. Une clé de
déploiement volée ne peut donc relancer que du code relu et mergé.

**Les images sont privées.** Le serveur ne garde aucun identifiant GHCR. Le
job Deploy envoie, à la suite du `.env`, le jeton que GitHub crée pour ce job
(`GITHUB_TOKEN`). Ce jeton ne peut que lire les paquets et expire à la fin du
job. `rekr-deploy` s'en sert le temps du téléchargement, dans une
configuration Docker temporaire, puis l'efface ; il n'est jamais écrit dans le
`.env`. Le dépôt `rekr-app` doit donc garder son accès aux trois paquets
(paquet > Package settings > Manage Actions access, rôle **Write** au moins :
le job Images y pousse aussi).

Les scripts `scripts/ci/*.sh` et `scripts/deploy/rekr-deploy` ne dépendent pas
de GitHub : seul le fichier du workflow serait à réécrire pour une autre CI.

## Préparer le compte `deploy` et le dépôt

Une seule fois, depuis un compte administrateur.

Sur son ordinateur, générer la paire de clés du déploiement (sans phrase de
passe : un robot ne peut pas en taper une) :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/rekr_deploy -N "" -C "github-actions-deploy@rekr"
```

Sur le serveur, créer le compte, sans mot de passe ni `sudo` :

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
```

Installer le script de déploiement. Il appartient à `root` : le compte qu'il
sert ne peut pas le modifier. Le lire avant de l'installer :

```bash
curl -fsSL https://raw.githubusercontent.com/2iAcademy/rekr-app/main/scripts/deploy/rekr-deploy -o /tmp/rekr-deploy
less /tmp/rekr-deploy
sudo install -m 755 -o root -g root /tmp/rekr-deploy /usr/local/bin/rekr-deploy
```

Le refaire à chaque modification de `scripts/deploy/rekr-deploy` : la CD ne
met jamais à jour son propre garde-fou.

Puis poser la clé publique (`~/.ssh/rekr_deploy.pub`), restreinte au script.
Remplacer `CLE_PUBLIQUE` par le contenu du fichier, en gardant les apostrophes :

```bash
echo 'restrict,command="/usr/local/bin/rekr-deploy" CLE_PUBLIQUE' | sudo -u deploy tee /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

`restrict` coupe le terminal et les redirections de port, `command=` impose le
script quoi que demande la connexion. Vérifier que le compte est dans `docker`
et pas dans `sudo` :

```bash
id deploy
```

Créer le dossier de l'application. Il appartient à `deploy`, dans le groupe
`docker` : les administrateurs le lisent par le groupe, et le bit `2` de `2775`
(setgid) garde tout ce qui est créé dedans dans ce groupe.

```bash
sudo install -d -m 2775 -o deploy -g docker /opt/rekr
```

Rien d'autre à y mettre : le premier déploiement y crée `repo.git`, une copie
Git sans fichiers de travail qui sert à vérifier les commits, puis
`compose.prod.yml` et `.env`. **Toute commande Git sur le serveur passe par
`sudo -u deploy`** : lancée depuis un autre compte, elle créerait des fichiers
que `deploy` ne pourrait plus remplacer.

Relever enfin la clé du serveur, pour le secret `DEPLOY_KNOWN_HOSTS`, et
comparer son empreinte avec celle lue sur le serveur lui-même :

```bash
ssh-keyscan -t ed25519 rekr.tech
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

## Configurer l'environnement GitHub `production`

Dépôt GitHub > Settings > Environments > New environment `production` :

- **Required reviewers** : Julien et Diego ;
- **Deployment branches** : `main` uniquement.

**Secrets** de l'environnement (jamais au niveau du dépôt) :

| Secret                                | Valeur                                                             |
| ------------------------------------- | ------------------------------------------------------------------ |
| `POSTGRES_PASSWORD`                   | `openssl rand -hex 24`                                             |
| `JWT_SECRET`                          | `openssl rand -base64 48`                                          |
| `SMTP_USER`, `SMTP_PASSWORD`          | Identifiants SMTP Brevo                                            |
| `ELASTIC_PASSWORD`                    | `openssl rand -hex 24`                                             |
| `ELASTICSEARCH_API_KEY`               | Vide au premier déploiement, voir plus bas                         |
| `STREAM_API_KEY`, `STREAM_API_SECRET` | App Stream de **production** (EU West), pas celle du développement |
| `SENTRY_DSN`                          | Facultatif                                                         |
| `DEPLOY_SSH_KEY`                      | Contenu de `~/.ssh/rekr_deploy` (la clé **privée**)                |
| `DEPLOY_KNOWN_HOSTS`                  | La ligne affichée par `ssh-keyscan`                                |

**Variables** de l'environnement (non secrètes) :

| Variable                                | Valeur                                 |
| --------------------------------------- | -------------------------------------- |
| `DOMAIN`                                | `rekr.tech`                            |
| `POSTGRES_USER`, `POSTGRES_DB`          | `rekr`                                 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | `smtp-relay.brevo.com`, `587`, `false` |
| `MAIL_FROM`                             | `Rekr <no-reply@rekr.tech>`            |
| `DEPLOY_HOST`                           | `rekr.tech`                            |
| `DEPLOY_USER`                           | `deploy`                               |
| `SENTRY_TRACES_SAMPLE_RATE`             | Facultatif                             |

`DEPLOY_HOST` doit être exactement le nom passé à `ssh-keyscan` : SSH cherche
la clé du serveur sous ce nom dans `DEPLOY_KNOWN_HOSTS`, et une adresse IP à la
place échouerait sur `Host key verification failed`. Le pare-feu doit aussi
laisser passer le port 22 depuis GitHub Actions, dont les adresses changent à
chaque exécution.

**Variable du dépôt** (Settings > Secrets and variables > Actions > Variables,
pas dans l'environnement) : `VITE_SENTRY_DSN`, facultatif. Le DSN du front est
inscrit dans l'image au build, et le job qui construit les images n'a pas
d'environnement : il n'attend aucune approbation. Ce DSN est public par
nature, il finit dans le JavaScript servi aux navigateurs.

Une valeur ne doit contenir ni apostrophe ni retour à la ligne : le workflow la
refuse plutôt que de produire un `.env` faux. `.env.prod.example` reste la
liste de référence des variables.

Une fois `DEPLOY_SSH_KEY` enregistré, supprimer la clé privée de son
ordinateur : GitHub la garde, et en cas de perte on en génère une autre.

```bash
rm ~/.ssh/rekr_deploy
```

## Premier déploiement

1. Merger `preprod` dans `main`. Le workflow CI/CD passe la CI, pousse les
   images, puis s'arrête sur le job Deploy. Approuver le déploiement dans
   l'onglet Actions.

   Au premier démarrage, Caddy obtient le certificat HTTPS de `rekr.tech` ; le
   backend démarre sans clé Elasticsearch et bascule sur le tri PostgreSQL :
   c'est attendu.

2. Sur le serveur, créer la clé d'API du backend. Le script vient de la copie
   Git du serveur, à la version de `main` :

   ```bash
   cd /opt/rekr
   sudo -u deploy git -C repo.git show main:docker/elasticsearch/create-api-key.sh | sh
   ```

3. Coller la valeur affichée dans le secret `ELASTICSEARCH_API_KEY`.
4. Actions > CI/CD > Run workflow sur `main`, en cochant « Reconstruire
   l'index Elasticsearch », puis approuver. Les déploiements suivants
   repartent sans cette case.

## Mettre à jour

Merger dans `main`, puis approuver le job Deploy une fois la CI et les images
passées. Pour changer un secret : le modifier dans l'environnement
`production`, puis Actions > CI/CD > Run workflow. Le service `migrate`
applique les nouvelles migrations avant que le backend ne redémarre.

**Revenir en arrière** : voir le [runbook](ops/runbook.md), fiche 7. Chaque
version reste sur GHCR sous son hash ; remettre l'ancien dans `IMAGE_TAG`
suffit, sans rien reconstruire.

**Dépannage sans GitHub**, depuis un compte administrateur : le `.env` et le
`compose.prod.yml` du dernier déploiement restent en place.

```bash
cd /opt/rekr && docker compose -f compose.prod.yml up -d --no-build
```

**Changer la clé de déploiement** (fuite, départ, doute) : générer une nouvelle
paire, remplacer la ligne de `/home/deploy/.ssh/authorized_keys` et le secret
`DEPLOY_SSH_KEY`. L'ancienne clé ne sert plus à rien.

## Vérifier

```bash
docker compose -f compose.prod.yml ps
docker compose -f compose.prod.yml logs -f backend
curl -I https://rekr.tech
```

## Sauvegarder

Deux choses à sauvegarder, toujours ensemble : la base et les fichiers déposés
(CV, photos, logos), qui vivent dans le volume `backend_uploads`. L'une sans
l'autre laisse des lignes qui pointent vers des fichiers absents.

```bash
docker compose -f compose.prod.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > rekr-$(date +%F).dump
docker run --rm -v rekr_backend_uploads:/data:ro -v "$PWD":/out alpine \
  tar czf /out/uploads-$(date +%F).tar.gz -C /data .
```

L'index Elasticsearch ne se sauvegarde pas : il se reconstruit depuis
PostgreSQL.

## En cas de panne

Le [runbook](ops/runbook.md) part d'un symptôme et donne le diagnostic, le remède et la vérification.
