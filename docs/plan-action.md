# Plan d'action

Suite de l'[audit global](audit-global.md). Le premier passage, sur `main` au commit `8cdb16d`, avait donné 177/224. Nous avions retenu quatre actions peu coûteuses qui faisaient chacune passer au moins un critère à 2, et visions 187/224 (83 %).

## Actions réalisées

| # | Action | Critères | Gain | Ticket | Pull request |
| --- | --- | --- | --- | --- | --- |
| 1 | Suivre la dette technique : étiquette `dette` et `docs/TECH-DEBT.md` | F4, F5 | +4 | [#312](https://github.com/2iAcademy/rekr-app/issues/312) | #324 |
| 2 | Logs backend en JSON avec un `request_id` par requête | J2 | +2 | [#316](https://github.com/2iAcademy/rekr-app/issues/316) | #325 |
| 3 | Scan des images Docker avec Trivy dans `ci-cd.yml` | H6 | +2 | [#313](https://github.com/2iAcademy/rekr-app/issues/313) | #342 |
| 4 | ADR dans `docs/adr/` pour les choix déjà justifiés dans le dossier | D3, M3 | +2 | [#308](https://github.com/2iAcademy/rekr-app/issues/308) | #318 |

Les écarts laissés au backlog ont aussi été traités : `CONTRIBUTING.md` ([#309](https://github.com/2iAcademy/rekr-app/issues/309), #328), le schéma d'architecture ([#310](https://github.com/2iAcademy/rekr-app/issues/310), #341), `CHANGELOG.md` ([#311](https://github.com/2iAcademy/rekr-app/issues/311), #326), Hadolint ([#314](https://github.com/2iAcademy/rekr-app/issues/314), #343) et gitleaks ([#315](https://github.com/2iAcademy/rekr-app/issues/315), #327). Tout est en production depuis la version 1.3.0, le 28 octobre.

Score au second passage, sur `98d0851` : **202/224 (90 %)**, au-dessus de l'objectif.

## Écarts restants

Les 19 critères encore notés 0 ou 1. Pour chacun, l'action qui le ferait passer à 2, ou la raison de le laisser en l'état.

| Critère | Note | Action | Décision |
| --- | --- | --- | --- |
| B3 · `docs/plan-formation.md` | 1 | Reprendre dans le dépôt le plan de formation du dossier (XXIV.6) | À faire |
| B6 · Désaccords | 1 | Écrire comment un désaccord se tranche (en revue, puis en point d'équipe) | À faire |
| G4 · Retour arrière chronométré | 1 | Chronométrer la fiche 7 du runbook sur une copie de la pile | À faire |
| G6 · Plan d'optimisation | 1 | Rédiger un plan d'optimisation à partir des indicateurs de XX.2 | À faire |
| I3 · CSRF, CSP | 1 | Documenter la protection CSRF par cookie `sameSite: 'strict'` et ajouter la CSP | À faire, [#319](https://github.com/2iAcademy/rekr-app/issues/319) |
| I6 · Droits PostgreSQL | 1 | Décrire, puis restreindre si besoin, les droits du rôle de l'application | À faire |
| K1 · Vivant et prêt | 1 | Séparer les sondes de santé | À faire, [#323](https://github.com/2iAcademy/rekr-app/issues/323) |
| K4 · Alerte reliée au runbook | 1 | Ajouter le lien de la fiche concernée dans la règle d'alerte Sentry | À faire |
| L4 · Point de rupture | 1 | Monter la charge k6 par paliers jusqu'à la première erreur | À faire |
| L7 · Coûts mensuels | 1 | Relever chaque mois les factures Hetzner et des services | À faire |
| O4 · Environnements arrêtés | 1 | Documenter l'arrêt de la pile locale (`docker compose down`) | À faire |
| Q1 · Section éthique | 1 | Regrouper dans le dossier les éléments épars (VIII.8, X.4, XVII.6) | À faire |
| Q2 · Biais testés | 0 | Tester que le classement du fil ne dépend d'aucun attribut personnel hors des critères déclarés | À faire |
| Q3 · Recours humain | 1 | Relier la procédure de modération au classement du fil | À faire |
| R5 · Oral chronométré | 1 | Répéter la soutenance chronomètre en main, avec un plan B hors ligne | À faire |
| R6 · Questions du jury | 0 | Préparer 15 questions probables et leurs réponses | À faire |
| S4 · Qualité des données | 1 | Contrôler les champs des événements avant l'écriture dans HDFS | Accepté : prototype de développement |
| S5 · Essai volumineux chronométré | 1 | Relever la durée de l'analyse Spark sur le jeu synthétique | À faire |
| S6 · Gouvernance des données | 0 | Écrire qui accède aux événements, combien de temps ils sont gardés et comment ils sont effacés | Accepté : prototype de développement, sans donnée réelle |
