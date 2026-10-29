# Audit global du projet

Audit de Rekr sur les 20 domaines de la grille « Audit global du projet » (module 12). Chaque critère reçoit une note et la preuve qui la justifie.

État audité : branche `main` au commit `98d0851`, version [v1.3.0](https://github.com/2iAcademy/rekr-app/releases/tag/v1.3.0), le 28 octobre 2026. Un premier passage, au commit `8cdb16d`, avait donné 177/224 ; ses écarts ont produit le [plan d'action](plan-action.md).

Notes : **2** preuve trouvée, **1** preuve partielle ou ailleurs que là où la grille la cherche, **0** introuvable, **N/A** ne s'applique pas.

Les preuves renvoient au dépôt (fichiers, pull requests, tickets) et au dossier de projet. « Dossier XIX.1 » désigne une section du dossier, « fig. 26 » une de ses figures.

## A. Cadrage, pilotage et gestion de projet

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| A1 | Faisabilité, PESTEL, SWOT | Dossier IX.1 (fig. 3), IX.2 (fig. 4), IX.3, IX.6 (ROI) | 2 |
| A2 | Veille datée, décision liée | Dossier X.2 (Feedly, fig. 5), X.3, X.4 (choix structurants) | 2 |
| A3 | User stories, critères, MoSCoW | Dossier VII.4, VII.6, XIV.4 (fig. 14) ; `.github/ISSUE_TEMPLATE/user_story.yml` | 2 |
| A4 | Méthode appliquée, suivi à jour | Dossier XI.1, XI.3, XXIV.5 ; tableau Kanban GitHub Projects (fig. 54) | 2 |
| A5 | Gantt, écart prévu / réalisé | Dossier XI.4, XII.2 ; fig. 7, 55 et 56 | 2 |
| A6 | KPI avec cible et valeur | Dossier XI.8, XII.2 (burndown, fig. 6) | 2 |
| A7 | Registre des risques | Dossier IX.4 (probabilité, impact, criticité), IX.5 (mitigation) | 2 |
| A8 | Imprévus et décisions | Dossier XII.4 (arbitrages), XII.5 (problèmes et actions correctives) | 2 |
| **Total** | | | **16/16** |

## B. Équipe, compétences et plan de formation

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| B1 | Matrice RACI | Dossier XXIV.2 (fig. 51) | 2 |
| B2 | Compétences requises et présentes | Dossier XXIV.1 (compétences par tâche) | 2 |
| B3 | `docs/plan-formation.md` | Plan de formation dans le dossier (XXIV.6, XXIII.4), pas de fichier dans le dépôt | 1 |
| B4 | Revues, pas de point unique | Toutes les pull requests d'équipe relues sauf celle du runbook (dossier XXII.1, fig. 48) ; `preprod` et `main` exigent une approbation | 2 |
| B5 | Rétrospectives | Dossier XXIV.5, XXIV.7, XII.7 | 2 |
| B6 | Communication, désaccords | Rituels et outils en XXIV.5 ; la gestion des désaccords n'apparaît que comme compétence du chef de projet (XXIV.1) | 1 |
| **Total** | | | **10/12** |

## C. Choix techniques, périmètre et sobriété

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| C1 | Comparaison avec une alternative | Dossier X.4 (microservices et apprentissage automatique écartés), XIII.7 ; [ADR 0001 à 0004](adr/README.md) | 2 |
| C2 | Contrat front / back | OpenAPI généré par Swagger et client Orval (`clientApp/orval.config.ts`) ; dossier XVI.2, fig. 59 et 60 | 2 |
| C3 | MVP et hors périmètre | Dossier VII.5, VIII.4, XVI.6 (back-office reporté en V2, fig. 65) | 2 |
| C4 | Justification de chaque service | Dossier XIII.2 ; [`architecture.md`](architecture.md) ; [`deploiement-vps.md`](deploiement-vps.md) | 2 |
| C5 | Section « limites » | Dossier XVI.6, XXI.3, XXII.2 et conclusion ; [`TECH-DEBT.md`](TECH-DEBT.md) | 2 |
| **Total** | | | **10/10** |

## D. Architecture, dépôt et cohérence technique

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| D1 | `docs/architecture.md` et schéma | [`architecture.md`](architecture.md), schémas de production et de développement dans `docs/diagrams/` (#341) | 2 |
| D2 | Arborescence lisible | `backend/`, `clientApp/`, `e2e/`, `loadtest/`, `data/`, `docker/`, `scripts/`, `docs/` | 2 |
| D3 | Au moins un ADR | `docs/adr/` : modèle et quatre décisions (#318) | 2 |
| D4 | Couches séparées | Modules NestJS par domaine dans `backend/src/` (contrôleur, service, DTO) ; dossier XVI.1 | 2 |
| D5 | Historique Git propre | 522 commits sur `main`, messages conventionnels, fusion par pull request seulement ; dossier XIV.1 | 2 |
| D6 | Dépendances inventoriées | `.github/dependabot.yml` (npm, actions, images Docker) ; dossier XIV.3 | 2 |
| **Total** | | | **12/12** |

## E. Qualité logicielle et tests

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| E1 | Tests unitaires et leur nombre | 43 suites Jest (656 tests) côté backend, 112 fichiers Vitest (1 400 tests) côté frontend ; dossier XIX.1 | 2 |
| E2 | Tests contre une vraie base | Job `backend-test` avec un service PostgreSQL, base de test créée puis détruite ; dossier XIV.5, XVIII.4 | 2 |
| E3 | Couverture et seuil | 80 % par dossier ciblé côté frontend, seuil sur les services côté backend (`backend/scripts/check-service-coverage.mjs`, #281) ; dossier XIV.4 | 2 |
| E4 | Linter en CI | Jobs `backend-lint` et `frontend-lint` (ESLint, Prettier) ; hook de pré-push (fig. 13) | 2 |
| E5 | Test rouge qui bloque la fusion | Contrôles obligatoires « Backend CI » et « Frontend CI » sur `preprod` et `main` ; dossier XIV.4, XVIII.1 | 2 |
| E6 | Parcours de bout en bout | `e2e/` (Playwright, job « E2E navigateur », #287) ; dossier XIX.2 (35 scénarios de recette) | 2 |
| **Total** | | | **12/12** |

## F. Dette technique et maintenabilité

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| F1 | Rapport SonarCloud, dette | `sonar-project.properties`, job « Sonar » ; dossier XIV.4 (environ 23 h de dette) | 2 |
| F2 | Quality gate bloquant | Contrôles obligatoires « Backend CI » et « Frontend CI » (types, lint, tests, seuils de couverture) ; les indicateurs SonarCloud restent en suivi (dossier XIV.4) | 2 |
| F3 | Tableau des métriques | Complexité, duplication (3,1 %), couverture et dette suivies par SonarCloud ; dossier XIV.4 | 2 |
| F4 | Étiquette « dette » au backlog | Étiquette [`dette`](https://github.com/2iAcademy/rekr-app/issues?q=label%3Adette) sur les tickets de dette, ouverts (#319 à #323) et remboursés (#313, #314, #316) | 2 |
| F5 | `TECH-DEBT.md` ou ADR | [`TECH-DEBT.md`](TECH-DEBT.md) : impact et ticket de chaque dette (#324) | 2 |
| F6 | Definition of Done | Critères d'acceptation de chaque user story et approbation de la pull request ; dossier XIV.4 | 2 |
| F7 | PR Dependabot fusionnées | 93 pull requests Dependabot fusionnées, 25 refermées après examen | 2 |
| F8 | KISS, DRY, YAGNI, code mort | Duplication à 3,1 % (dossier XIV.4) ; dépendances inutiles retirées de l'image de l'API (#255, dossier XVI.7) | 2 |
| **Total** | | | **16/16** |

## G. DevOps : chaîne CI/CD

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| G1 | Workflow versionné | `.github/workflows/ci-cd.yml` | 2 |
| G2 | Graphe des jobs | Commentaire en tête de `ci-cd.yml` ; fig. 25 et 34 | 2 |
| G3 | Durées, cache actif | Moins de six minutes dans 9 cas sur 10 (dossier XXII.2) ; cache npm dans chaque job | 2 |
| G4 | Tag immuable, retour arrière | Images étiquetées par l'empreinte du commit (fig. 37), retour arrière décrit en XX.3 et dans le [runbook](ops/runbook.md) (fiche 7), testé avant la mise en ligne mais pas chronométré | 1 |
| G5 | Configuration par environnement | `compose.yml` et `compose.prod.yml`, `.env.prod.example`, environnement GitHub « production » (fig. 35) | 2 |
| G6 | Indicateurs de livraison | Indicateurs DORA en XX.2 (6 déploiements réussis sur 9, 9 à 10 minutes de la fusion à la production) ; pas de plan d'optimisation écrit | 1 |
| **Total** | | | **10/12** |

## H. Conteneurisation

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| H1 | Multi-stage, non root | `backend/Dockerfile` (étapes séparées, `USER node`), `clientApp/Dockerfile` (image finale Caddy) ; Hadolint en CI, une erreur bloque le build (#343) | 2 |
| H2 | `.dockerignore`, taille | `.dockerignore` dans `backend/` et `clientApp/` ; image de l'API passée de 947 à 560 Mo (#255, dossier XVI.7) | 2 |
| H3 | Démarrage en une commande | README « Getting started », [`CONTRIBUTING.md`](../CONTRIBUTING.md) ; dossier annexe 9 | 2 |
| H4 | Limites, healthcheck, ordre | `compose.prod.yml` : `mem_limit`, `healthcheck`, `restart`, `depends_on` avec conditions | 2 |
| H5 | Volumes, réseaux | `compose.prod.yml` : volumes nommés, réseau Docker interne, seul Caddy publie des ports | 2 |
| H6 | Image scannée | Trivy sur les images backend, migrate et web, en pull request et avant le déploiement ; une faille critique corrigeable bloque (#342) | 2 |
| **Total** | | | **12/12** |

## I. Sécurité

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| I1 | Aucun secret | Job gitleaks sur tout l'historique, `.gitleaks.toml` (#327) ; détection des secrets GitHub (dossier XXI.3) | 2 |
| I2 | Rôles, hachage | Gardes JWT et rôles, bcrypt ; dossier XVI.4, tests de sécurité en XIX.1 | 2 |
| I3 | SQL, XSS, CSRF | Prisma (requêtes paramétrées), Helmet, limitation de débit, `security-hardening.e2e-spec.ts` ; dossier XVI.5. Le CSRF est traité par le cookie `sameSite: 'strict'` (`backend/src/auth/refresh-cookie.ts`) mais n'est pas documenté, et la CSP du front manque (#319) | 1 |
| I4 | Dépendances scannées | Dependabot (105 alertes traitées ou ouvertes, 4 ouvertes au 28 octobre), CodeQL ; dossier XXI.3, fig. 44 et 45 | 2 |
| I5 | HTTPS, en-têtes, CORS | Certificat Let's Encrypt (fig. 32), HSTS, Helmet ; dossier XVI.5 | 2 |
| I6 | Moindre privilège, restauration | `USER node`, clé Elasticsearch limitée à l'index (dossier XIII.2), compte de déploiement sans sudo (XX.2), restauration testée (fig. 46). Les droits du rôle PostgreSQL de l'application ne sont pas décrits | 1 |
| I7 | Données personnelles, conservation | Dossier XII.3 (durées de conservation), XIII.6 ; purge des comptes inactifs depuis 24 mois | 2 |
| **Total** | | | **12/14** |

## J. Journalisation

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| J1 | Logs sur stdout, niveaux | `SentryLogger` (logger de NestJS) ; dossier XXI.2 | 2 |
| J2 | JSON, `request_id` | Logs en JSON, `request_id` repris de `X-Request-Id` posé par Caddy (#325) | 2 |
| J3 | Ni secret ni donnée personnelle | Dossier XXI.2 (jeton masqué, e-mails exclus de Sentry) | 2 |
| J4 | Rotation et durée | Rotation Docker `max-size` 10 Mo, 3 fichiers (`deploiement-vps.md`) ; dossier XXI.1 | 2 |
| J5 | Erreur avec contexte | Erreur de production avec pile et requête dans Sentry (fig. 41) | 2 |
| **Total** | | | **10/10** |

## K. Observabilité et monitoring

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| K1 | Santé « vivant » et « prêt » | `/api/health` (PostgreSQL) et `/api/health/search` (Elasticsearch), sans distinction vivant / prêt (#323) | 1 |
| K2 | `/metrics`, cible Prometheus | `backend/src/metrics/`, service `prometheus` dans `compose.yml`, `docker/prometheus/` (#272) ; `/api/metrics` bloqué en production (#296) | 2 |
| K3 | Tableau de bord Grafana | Tableau `rekr-api-monitoring` provisionné dans `docker/grafana/`, [`grafana-prometheus.md`](grafana-prometheus.md) | 2 |
| K4 | Alerte reliée à un runbook | Sonde Sentry et alerte par e-mail (fig. 40 et 42), [runbook](ops/runbook.md) ; l'alerte ne renvoie pas à sa fiche | 1 |
| K5 | Incident simulé documenté | Incident du 6 octobre traité de bout en bout (dossier XIV.5) | 2 |
| **Total** | | | **8/10** |

## L. Évolution et exploitation continue

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| L1 | Stratégie de mises à jour | Dependabot hebdomadaire, majeures à la main (dossier XIV.3) ; correctifs système automatiques (XXI.3) | 2 |
| L2 | CHANGELOG, tags | [`CHANGELOG.md`](../CHANGELOG.md) au format Keep a Changelog (#326, #350), tags et releases `v1.0.0` à `v1.3.0` | 2 |
| L3 | Mesures datées comparées | Latence et durée du pipeline (dossier XXII.2), k6 à chaque pull request (fig. 28) | 2 |
| L4 | Test de charge, point de rupture | `loadtest/`, 50 candidats simultanés sans échec (fig. 26) ; point de rupture pas cherché | 1 |
| L5 | Dérive d'un composant IA | Pas d'IA : classement par règles explicites (dossier XVII.6) | N/A |
| L6 | Secours essayés | Restauration testée (fig. 46), sauvegarde Hetzner testée (fig. 47), fiche 11 du runbook | 2 |
| L7 | Coûts mensuels | Budget prévisionnel (dossier XI.6) ; pas de suivi mensuel des coûts réels | 1 |
| **Total** | | | **10/12** |

## M. Documentation technique

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| M1 | README testé par un tiers | README suivi par le second membre de l'équipe ; démarrage en une commande vérifié lors de l'audit du socle (dossier annexe 9) | 2 |
| M2 | Diagrammes dans `docs/` | `docs/diagrams/` : production, développement, cas d'utilisation, séquence, BPMN (#341) | 2 |
| M3 | ADR et runbook | `docs/adr/` (#318), [`ops/runbook.md`](ops/runbook.md), [`ops/moderation.md`](ops/moderation.md) | 2 |
| M4 | OpenAPI / Swagger | `/api/docs` en développement ; dossier annexe 5 (fig. 59 et 60) | 2 |
| M5 | `.env.example`, CONTRIBUTING | `.env.example` à la racine, dans `backend/` et `clientApp/` ; [`CONTRIBUTING.md`](../CONTRIBUTING.md) (#328) | 2 |
| **Total** | | | **10/10** |

## N. Accessibilité

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| N1 | HTML sémantique, formulaires | Dossier XV.4 | 2 |
| N2 | Contrastes | Dossier XV.4, VIII.8 | 2 |
| N3 | Clavier, focus visible | Dossier XV.4 (fig. 17), lien d'évitement (#276) | 2 |
| N4 | Alternatives textuelles, ARIA | Dossier XV.4 | 2 |
| N5 | Audit automatisé avant / après | Lighthouse (dossier XXII.3, #269), 11 non-conformités RGAA corrigées (#283) | 2 |
| N6 | Lecteur d'écran mobile | Test VoiceOver ; dossier XV.4 | 2 |
| **Total** | | | **12/12** |

## O. Éco-conception

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| O1 | Poids des pages | Dossier XXV (EcoIndex, fig. 53), XIII.7 | 2 |
| O2 | Requêtes évitées | Pagination, identifiants seuls renvoyés par Elasticsearch ; dossier XIII.7, XVI.7 | 2 |
| O3 | Images légères, ressources | Images Alpine, `mem_limit` sur chaque service ; dossier XVI.7 | 2 |
| O4 | Environnements arrêtés | L'environnement de test de la CI disparaît à la fin de chaque exécution, et aucune préproduction ne tourne en permanence (dossier XX.1) ; pas de règle pour la pile locale | 1 |
| O5 | Indicateur d'impact | Lighthouse (fig. 52), EcoIndex (fig. 53) | 2 |
| **Total** | | | **9/10** |

## P. Anglais technique

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| P1 | Code en anglais | Noms, commentaires et messages d'erreur en anglais | 2 |
| P2 | Commits et README en anglais | README en anglais (fig. 63) ; dossier XXIV.4 | 2 |
| P3 | Documentation clé en anglais | README, CONTRIBUTING, Swagger, notes de release ; dossier XXIII.3 | 2 |
| P4 | Glossaire de 20 termes | Glossaire du dossier (III) | 2 |
| P5 | Oral en anglais (30 s) | Abstract du dossier (V.1) | 2 |
| **Total** | | | **10/10** |

## Q. Éthique, biais et responsabilité

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| Q1 | Section éthique | Éléments épars : accessibilité comme non-discrimination (dossier VIII.8), règlement européen sur l'IA (X.4) ; pas de section dédiée | 1 |
| Q2 | Biais testés | Aucun test de biais sur le classement du fil | 0 |
| Q3 | Décisions explicables | Règles explicites (dossier XVII.6, [`ranking-du-feed-candidat.md`](ranking-du-feed-candidat.md)) ; recours humain par la [modération](ops/moderation.md), non relié au classement | 1 |
| Q4 | Sobriété chiffrée | Dossier XXV, VIII.8 | 2 |
| **Total** | | | **4/8** |

## R. Dossier, soutenance et communication

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| R1 | Plan clair | Table des matières du dossier | 2 |
| R2 | État de l'art, bibliographie | Dossier X.4, bibliographie | 2 |
| R3 | Figures numérotées, table | Table des figures (65 figures) | 2 |
| R4 | Chiffres sourcés | Chiffres du dossier datés et rattachés au dépôt (pull requests, exécutions, alertes) | 2 |
| R5 | Oral chronométré, plan B | Support de soutenance préparé ; durée et plan B non tracés | 1 |
| R6 | 15 questions avec réponses | Introuvable | 0 |
| R7 | Résumé en anglais | Abstract du dossier (V.1) | 2 |
| **Total** | | | **11/14** |

## S. Données volumineuses

| N° | Preuve attendue | Preuve | Note |
| --- | --- | --- | --- |
| S1 | Volumétrie | Dossier XVII.1 (les 5V) | 2 |
| S2 | Stockage justifié | Dossier XVII.4, XVII.7 ; `data/README.md` | 2 |
| S3 | Traitement scalable | Spark (dossier XVII.2, XVII.5, fig. 22 et 23) ; `compose.data.yml` | 2 |
| S4 | Qualité des données | Dossier XVII.7 ; `data/storage.test.cjs` ; pas de contrôle de qualité dans la chaîne | 1 |
| S5 | Essai volumineux chronométré | Jeu synthétique (dossier XVII.5, fig. 23), durée non relevée | 1 |
| S6 | Gouvernance | Rien pour la chaîne de données (la conservation des comptes est en XII.3) | 0 |
| **Total** | | | **8/12** |

## T. IA prédictive et analytique

Non applicable. Le matching repose sur des règles explicites, sans apprentissage automatique (dossier X.4, XVII.6). L'analyse prédictive de XVII.5 est un calcul Spark sur un jeu synthétique, pas un modèle entraîné.

## Récapitulatif

| Domaine | Critères notés | Total | Score |
| --- | --- | --- | --- |
| A · Cadrage, pilotage | 8 | 16/16 | 100 % |
| B · Équipe, compétences | 6 | 10/12 | 83 % |
| C · Choix techniques, périmètre | 5 | 10/10 | 100 % |
| D · Architecture, dépôt | 6 | 12/12 | 100 % |
| E · Qualité, tests | 6 | 12/12 | 100 % |
| F · Dette technique | 8 | 16/16 | 100 % |
| G · CI/CD | 6 | 10/12 | 83 % |
| H · Conteneurisation | 6 | 12/12 | 100 % |
| I · Sécurité | 7 | 12/14 | 86 % |
| J · Journalisation | 5 | 10/10 | 100 % |
| K · Observabilité | 5 | 8/10 | 80 % |
| L · Évolution, exploitation | 6 | 10/12 | 83 % |
| M · Documentation | 5 | 10/10 | 100 % |
| N · Accessibilité | 6 | 12/12 | 100 % |
| O · Éco-conception | 5 | 9/10 | 90 % |
| P · Anglais technique | 5 | 10/10 | 100 % |
| Q · Éthique | 4 | 4/8 | 50 % |
| R · Dossier, soutenance | 7 | 11/14 | 79 % |
| S · Données volumineuses | 6 | 8/12 | 67 % |
| T · IA prédictive | N/A | | |
| **Total** | **112** | **202/224** | **90 %** |

Les 19 critères notés 0 ou 1 sont repris dans le [plan d'action](plan-action.md).
