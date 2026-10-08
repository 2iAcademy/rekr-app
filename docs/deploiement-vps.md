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

Personne n'écrit le `.env` du serveur à la main. À chaque merge sur `main`, le
workflow `.github/workflows/deploy.yml` :

1. attend l'approbation de Julien ou de Diego (environnement GitHub
   `production`) ;
2. vérifie que tous les secrets obligatoires sont renseignés, avant de toucher
   au serveur ;
3. génère le `.env` depuis les secrets et variables de cet environnement ;
4. l'envoie au serveur en SSH avec le compte `deploy`, qui place le dépôt sur le
   commit mergé et lance `docker compose -f compose.prod.yml up -d --build` ;
5. vérifie que `https://rekr.tech/api/auth/me` répond 401.

Le compte `deploy` n'a ni `sudo` ni shell : sa clé SSH ne peut lancer que
`scripts/deploy/remote-deploy.sh`, qui n'accepte qu'un commit présent sur
`origin/main`. Julien et Diego gardent leurs comptes pour l'administration et
le dépannage.

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

Puis poser la clé publique (`~/.ssh/rekr_deploy.pub`), restreinte au script.
Remplacer `CLE_PUBLIQUE` par le contenu du fichier, en gardant les apostrophes :

```bash
echo 'restrict,command="/opt/rekr/scripts/deploy/remote-deploy.sh" CLE_PUBLIQUE' | sudo -u deploy tee /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

`restrict` coupe le terminal et les redirections de port, `command=` impose le
script quoi que demande la connexion. Vérifier que le compte est dans `docker`
et pas dans `sudo` :

```bash
id deploy
```

Le dépôt appartient à `deploy`, dans le groupe `docker` : c'est lui qui le met
à jour à chaque déploiement, et les administrateurs le lisent par le groupe. Le
bit `2` de `2775` (setgid) garde tout ce qui est créé dedans dans le groupe
`docker`.

```bash
sudo install -d -m 2775 -o deploy -g docker /opt/rekr
sudo -u deploy git clone https://github.com/2iAcademy/rekr-app.git /opt/rekr
```

**Toute commande Git sur le serveur passe par `sudo -u deploy`.** Un clone ou
un `git checkout` lancé depuis un compte administrateur créerait des fichiers
que `deploy` ne pourrait plus remplacer, et le déploiement suivant échouerait
sur `Permission denied`.

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

| Variable                                       | Valeur                                 |
| ---------------------------------------------- | -------------------------------------- |
| `DOMAIN`                                       | `rekr.tech`                            |
| `POSTGRES_USER`, `POSTGRES_DB`                 | `rekr`                                 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`        | `smtp-relay.brevo.com`, `587`, `false` |
| `MAIL_FROM`                                    | `Rekr <no-reply@rekr.tech>`            |
| `DEPLOY_HOST`                                  | `rekr.tech`                            |
| `DEPLOY_USER`                                  | `deploy`                               |
| `SENTRY_TRACES_SAMPLE_RATE`, `VITE_SENTRY_DSN` | Facultatifs                            |

`DEPLOY_HOST` doit être exactement le nom passé à `ssh-keyscan` : SSH cherche
la clé du serveur sous ce nom dans `DEPLOY_KNOWN_HOSTS`, et une adresse IP à la
place échouerait sur `Host key verification failed`. Le pare-feu doit aussi
laisser passer le port 22 depuis GitHub Actions, dont les adresses changent à
chaque exécution.

Une valeur ne doit contenir ni apostrophe ni retour à la ligne : le workflow la
refuse plutôt que de produire un `.env` faux. `.env.prod.example` reste la
liste de référence des variables.

Une fois `DEPLOY_SSH_KEY` enregistré, supprimer la clé privée de son
ordinateur : GitHub la garde, et en cas de perte on en génère une autre.

```bash
rm ~/.ssh/rekr_deploy
```

## Premier déploiement

1. Merger `preprod` dans `main`. Avant d'approuver le déploiement, placer une
   fois le dépôt du serveur sur `main` : le compte `deploy` ne peut lancer que
   `scripts/deploy/remote-deploy.sh`, qui doit donc déjà s'y trouver, et un
   clone frais est sur `preprod`.

   ```bash
   sudo -u deploy git -C /opt/rekr fetch origin main
   sudo -u deploy git -C /opt/rekr checkout --detach origin/main
   ```

   Puis approuver le déploiement dans l'onglet Actions. Au premier démarrage, Caddy obtient le certificat HTTPS de
   `rekr.tech` ; le backend démarre sans clé Elasticsearch et bascule sur le tri
   PostgreSQL : c'est attendu.

2. Sur le serveur, créer la clé d'API du backend :

   ```bash
   cd /opt/rekr
   sh docker/elasticsearch/create-api-key.sh
   ```

3. Coller la valeur affichée dans le secret `ELASTICSEARCH_API_KEY`.
4. Actions > Deploy > Run workflow, en cochant « Reconstruire l'index
   Elasticsearch ». Les déploiements suivants repartent sans cette case.

## Mettre à jour

Merger dans `main`, puis approuver le déploiement. Pour changer un secret : le
modifier dans l'environnement `production`, puis Actions > Deploy > Run
workflow. Le service `migrate` applique les nouvelles migrations avant que le
backend ne redémarre.

**Dépannage sans GitHub**, depuis un compte administrateur : le `.env` du
dernier déploiement reste en place.

```bash
sudo -u deploy git -C /opt/rekr fetch origin main
sudo -u deploy git -C /opt/rekr checkout --detach origin/main
cd /opt/rekr && docker compose -f compose.prod.yml up -d --build
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
