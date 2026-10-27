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
   sont les contrôles obligatoires des PR et intègrent le résultat du scan Trivy
   lorsque les changements nécessitent de construire les images.
2. **Images** (sur `main` uniquement, une fois la CI verte) : construit trois
   images et les pousse sur GHCR, taguées avec le hash du commit
   (`scripts/ci/build-images.sh`) :
   - `rekr-backend` : l'API ;
   - `rekr-migrate` : les migrations Prisma ;
   - `rekr-web` : Caddy, avec le front et le `Caddyfile` dedans.
     Les trois images publiées sont ensuite scannées par Trivy avant de permettre
     le passage à `Deploy`.
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

### Scan des images avec Trivy

Sur les PR et `preprod`, le job `Image security` utilise les sorties de `changes` :
une PR qui ne modifie que la documentation ne reconstruit pas les images.
Les changements backend, frontend, Caddy, workflow ou scripts CI déclenchent le scan.
Le job appelle `scripts/ci/build-images.sh` avec `PUSH=0` : les mêmes cibles et
arguments que la production construisent localement `rekr-backend`, `rekr-migrate`
et `rekr-web`, sans publication ni identifiants GHCR. Les trois images sont
analysées, y compris les dépendances de développement présentes dans l'image de migration.
Le résultat participe aux contrôles obligatoires `Backend CI` et `Frontend CI`.

Sur `main`, le job `Images` construit et publie les trois images, puis Trivy
analyse leurs tags de commit avant que `Deploy` puisse démarrer. Une vulnérabilité
**CRITICAL avec une correction disponible** fait échouer le job (`ignore-unfixed`
et code de sortie 1). Une erreur technique du scanner bloque également la suite.
Les autres scans sont tout de même tentés après un premier échec. Une image peut
rester publiée dans GHCR après un échec, mais cette exécution ne la déploie pas ;
la version déjà en service continue de tourner. Trivy s'exécute dans GitHub Actions,
pas sur le VPS.

Dans **Actions → exécution CI/CD**, le résumé du job et ses logs indiquent les CVE,
paquets, versions installées et versions corrigées. Les rapports JSON filtrés sur
les CRITICAL corrigeables sont disponibles dans **Artifacts** sous `trivy-backend`,
`trivy-migrate` et `trivy-clientApp`, pendant 30 jours, même si le scan échoue.
Si aucun rapport n'a pu être généré, le résumé le signale : cela ne signifie pas
que l'image est sans vulnérabilité. Corriger les dépendances ou l'image de base
concernées, puis relancer la CI ; ne pas contourner le contrôle pour déployer.

#### Pourquoi ces modifications du workflow ?

| Modification                                                                   | Justification et effet                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `needs: changes` et condition sur `image-security`                             | Évite les builds pour une PR uniquement documentaire. Hors PR, les sorties de `changes` activent les contrôles : `preprod` est scanné à chaque exécution. Sur `main`, le scan se fait dans `Images`.                                                             |
| `scripts/ci/**` dans les filtres backend, frontend et E2E                      | Une modification des scripts de construction ou de résumé déclenche les validations, même sans changement du code applicatif.                                                                                                                                    |
| Appel partagé à `build-images.sh` avec `PUSH=0`                                | Construit les trois images une seule fois dans ce job, avec les définitions et arguments de production. Remplace les commandes dupliquées dans une matrice par un build commun et trois scans séquentiels. Les builds de compilation existants restent en place. |
| Scan de `rekr-migrate`                                                         | Cette image s'exécute aussi en production et contient le résultat du `npm ci` complet, dont des dépendances absentes de l'image API finale.                                                                                                                      |
| `scanners: vuln` et `vuln-type: os,library`                                    | Analyse les vulnérabilités des paquets système et des bibliothèques détectables dans les images finales. Complète les analyses du code et des dépendances, sans garantir l'absence de toute faille.                                                              |
| `severity: CRITICAL`, `ignore-unfixed: true`, `exit-code: 1`                   | Applique le critère du ticket : une CRITICAL corrigeable bloque. Les rapports sont filtrés selon cette règle, pas un inventaire de toutes les gravités.                                                                                                          |
| Dépendance des contrôles `Backend CI` et `Frontend CI` envers `image-security` | Rend un échec du scan bloquant via les contrôles déjà utilisés par les PR. Un scan ignoré sur une PR documentaire ne les fait pas échouer.                                                                                                                       |
| Scans dans `Images` après publication sur `main`                               | Vérifie les images publiées de ce commit avant de permettre le déploiement. Conserve la construction/publication existante et la dépendance de `Deploy` envers `Images`.                                                                                         |
| Condition `!cancelled()` et réussite du build pour chaque scan                 | Tente les scans suivants même si le premier échoue, mais pas après un build raté ou une annulation. L'échec initial reste bloquant.                                                                                                                              |
| Uploads et résumé avec `always()`                                              | Tente de conserver les diagnostics même après un échec. Un rapport absent est signalé ; les logs du build ou du scanner permettent d'en chercher la cause.                                                                                                       |
| Artefacts JSON conservés 30 jours                                              | Rend les rapports téléchargeables sans configurer SARIF ni accorder `security-events: write`. Le ticket accepte un artefact comme alternative à l'onglet Security.                                                                                               |
| Action Trivy fixée au SHA de la version 0.36.0                                 | Stabilise la révision de l'action utilisée. Cette référence doit être mise à jour explicitement ; elle ne fige pas la base de vulnérabilités téléchargée.                                                                                                        |
| 60 minutes par job d'images et 10 minutes par scan                             | Prévoit du temps pour les builds et trois scans tout en bornant une exécution bloquée. Ce sont des limites maximales, pas des attentes imposées.                                                                                                                 |
| Schéma en tête du workflow                                                     | Rend visibles les contrôles de sécurité et leur position avant le déploiement.                                                                                                                                                                                   |

#### Rôle du script Python de résumé

`scripts/ci/summarize-trivy.py` lit les trois rapports JSON et produit le même
format de tableau dans les logs et dans `GITHUB_STEP_SUMMARY`, sur les PR comme
sur `main`. Ce fichier partagé évite de répéter la mise en forme dans les deux
jobs. La bibliothèque standard Python suffit pour lire le JSON, échapper les
valeurs du tableau et distinguer un rapport vide d'un rapport absent ; aucune
dépendance Python supplémentaire n'est installée. Un JSON malformé fait échouer
l'étape de résumé.

Python est un choix de maintenance, pas une exigence de Trivy : `jq` aurait
également pu produire un résumé. Le script ne détecte aucune CVE, ne décide pas
de la gravité et ne remplace pas le code de sortie du scanner. Il présente les
résultats déjà filtrés par Trivy, dans le runner GitHub Actions. Aucun script
ni service supplémentaire n'est installé sur le VPS.

Sur le serveur, `rekr-deploy` :

- vérifie que le commit est sur `main` ;
- prend `compose.prod.yml` dans ce commit ;
- écrit le `.env` reçu, en fixant lui-même `IMAGE_TAG` au hash du commit ;
- tire les images ;
- seulement si toutes sont là, remplace les fichiers et lance
  `docker compose up -d --no-build`.

Le serveur ne construit rien et n'a pas le code source. Une clé de
déploiement volée ne peut donc relancer que du code relu et mergé.

Les scripts `scripts/ci/*.sh` et `scripts/deploy/rekr-deploy` ne dépendent pas
de GitHub : seul le fichier du workflow serait à réécrire pour une autre CI.

## Vérification des Dockerfiles avec Hadolint

Dans `.github/workflows/ci-cd.yml`, les jobs `Backend build` et `Frontend build`
exécutent Hadolint après le checkout et avant la compilation. Ils analysent
respectivement `backend/Dockerfile` et `clientApp/Dockerfile`. La référence de
l'action est fixée au commit de la version 3.5.0, qui utilise Hadolint 2.15.1.
Les chemins fournis à l'action sont relatifs à la racine du dépôt, y compris
pour le job frontend dont les commandes `run` utilisent `clientApp/`.

`failure-threshold: error` fait échouer le job dès qu'une règle de niveau erreur
est violée ; `no-fail: false` conserve ce code de sortie. Les dépendances déjà
présentes propagent cet échec vers `Backend CI` ou `Frontend CI`, puis bloquent
la publication et le déploiement sur `main`. Aucun nouveau service ne tourne sur
le VPS. Les filtres existants déclenchent ces jobs pour les changements des
applications ou du workflow ; une PR uniquement documentaire les ignore.

Les diagnostics sont consultables dans **Actions → exécution → Backend build /
Frontend build → Lint Dockerfile with Hadolint**. Un avertissement ne bloque pas
avec ce seuil, mais doit être corrigé ou explicitement justifié lors de la revue.
Il ne faut pas désactiver globalement les règles pour obtenir une CI verte.

### Diagnostics et exceptions actuels

- **DL3022, frontend :** `COPY --from=rekr-caddy` utilise un contexte BuildKit
  externe transmis par `compose.prod.yml` et `scripts/ci/build-images.sh`.
  Hadolint l'interprète comme un alias de stage manquant. Un commentaire explique
  ce cas et `# hadolint ignore=DL3022`, placé juste avant cette instruction,
  ignore uniquement ce diagnostic pour cette instruction. Le contexte reste
  nécessaire pour construire l'image.
- **DL3066, niveau information :** les deux Dockerfiles utilisent `USER node`
  dans leurs stages Node concernés. Cet utilisateur est fourni par les images
  officielles Node et les permissions utilisent déjà `node:node`. Le nom est
  conservé pour rester cohérent avec cette configuration. Le diagnostic reste
  visible ; aucune règle n'est désactivée pour le masquer.

Les constructions multi-stage et le `USER node` du stage backend `runner`
restent inchangés. Hadolint n'est pas une preuve exhaustive d'exécution non-root :
le stage frontend final repart de l'image Caddy et n'hérite pas du `USER node`
des stages précédents. Modifier son utilisateur demanderait une vérification
séparée des permissions, volumes et ports ; ce ticket ajoute le contrôle statique,
pas un changement du comportement de production.

### Reproduire le contrôle localement

Avec Hadolint 2.15.1 installé, depuis la racine :

```bash
hadolint --failure-threshold error backend/Dockerfile clientApp/Dockerfile
```

Pour afficher également les diagnostics volontairement ignorés pendant une revue :

```bash
hadolint --disable-ignore-pragma --failure-threshold error backend/Dockerfile clientApp/Dockerfile
```

Les erreurs Hadolint bloquent, même avec des tests applicatifs verts. Ce contrôle
lit les Dockerfiles et leurs instructions shell ; il ne construit pas les images
et ne remplace ni les tests, ni un scan de vulnérabilités des images.

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

**Images** : après le premier passage sur `main`, rendre publics les trois
paquets `rekr-backend`, `rekr-migrate` et `rekr-web` (organisation 2iAcademy >
Packages > paquet > Package settings > Change visibility). Le dépôt est déjà
public et aucun secret n'est dans une image ; sans ça, le serveur devrait
s'authentifier sur GHCR pour les tirer.

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
   images, puis s'arrête sur le job Deploy. Si le serveur doit les tirer sans
   authentification, rendre les paquets publics maintenant (voir plus haut),
   puis approuver le déploiement dans l'onglet Actions.

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
l'autre laisse des lignes qui pointent vers des fichiers absents. L'index
Elasticsearch ne se sauvegarde pas : il se reconstruit depuis PostgreSQL.

`scripts/ops/rekr-backup` le fait chaque nuit à 3 h 15 : un `pg_dump`, que
PostgreSQL rend cohérent sans arrêter l'application, et une archive du volume.
Il vérifie que le dump est lisible, range les deux fichiers dans
`/var/backups/rekr/` (lisible par root seulement) et supprime ceux de plus de
7 jours. Le journal est dans `/var/log/rekr-backup.log`.

Ces sauvegardes restent sur le disque du serveur : elles protègent d'une
erreur sur les données, pas de la perte du serveur. Pour cela, il faut une
copie ailleurs, par exemple l'option Backups de Hetzner, qui copie le disque
entier chaque jour sur leur stockage (20 % du prix du serveur).

Installation, une seule fois, depuis un compte administrateur (comme
`rekr-deploy`, les scripts appartiennent à root) :

```bash
for f in rekr-backup rekr-restore-test; do
  curl -fsSL "https://raw.githubusercontent.com/2iAcademy/rekr-app/main/scripts/ops/$f" -o "/tmp/$f"
  sudo install -m 755 -o root -g root "/tmp/$f" "/usr/local/bin/$f" && rm "/tmp/$f"
done
curl -fsSL https://raw.githubusercontent.com/2iAcademy/rekr-app/main/scripts/ops/rekr-backup.cron -o /tmp/rekr-backup.cron
sudo install -m 644 -o root -g root /tmp/rekr-backup.cron /etc/cron.d/rekr-backup && rm /tmp/rekr-backup.cron
```

Puis une première sauvegarde à la main, et la preuve qu'elle se restaure :

```bash
sudo rekr-backup
sudo rekr-restore-test
```

`rekr-restore-test` restaure la dernière sauvegarde dans une base PostgreSQL
jetable, sans réseau, et met le nombre de lignes des tables principales et le
nombre de fichiers en face de ceux de la production. Il échoue si une table
revient vide. À relancer de temps en temps : une sauvegarde qu'on n'a jamais
restaurée n'est pas une sauvegarde.

## En cas de panne

Le [runbook](ops/runbook.md) part d'un symptôme et donne le diagnostic, le remède et la vérification.
