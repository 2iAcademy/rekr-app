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

## Premier déploiement

Le dépôt appartient au groupe `docker`, pour que chaque administrateur puisse
le mettre à jour depuis son propre compte :

```bash
sudo mkdir -p /opt/rekr && sudo chown "$USER":docker /opt/rekr
git clone https://github.com/2iAcademy/rekr-app.git /opt/rekr
cd /opt/rekr
git config core.sharedRepository group && chmod -R g+w .
cp .env.prod.example .env && chmod 640 .env
```

Chaque autre administrateur, une fois :

```bash
git config --global --add safe.directory /opt/rekr
```

`.env` reste lisible par le seul groupe `docker`, dont les membres ont de toute
façon les droits de root sur le serveur.

Renseigner `.env` (les commandes de génération sont en commentaire dans le
fichier), en laissant `ELASTICSEARCH_API_KEY` vide. Puis :

```bash
docker compose -f compose.prod.yml up -d --build
```

Au premier démarrage, Caddy obtient le certificat HTTPS de `rekr.tech`. Le
backend démarre sans clé Elasticsearch et bascule sur le tri PostgreSQL : c'est
attendu.

Créer la clé d'API du backend, la reporter dans `.env`, et construire l'index :

```bash
sh docker/elasticsearch/create-api-key.sh
# coller la valeur affichée dans ELASTICSEARCH_API_KEY
# et passer ELASTICSEARCH_REINDEX_ON_STARTUP à true
docker compose -f compose.prod.yml up -d backend
# une fois l'index construit, remettre ELASTICSEARCH_REINDEX_ON_STARTUP à false
docker compose -f compose.prod.yml up -d backend
```

## Mettre à jour

```bash
cd /opt/rekr
git pull
docker compose -f compose.prod.yml up -d --build
```

Le service `migrate` applique les nouvelles migrations avant que le backend ne
redémarre.

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
