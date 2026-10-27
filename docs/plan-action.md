# Plan d'action

Suite de l'audit global (`docs/audit-global.md`, `main` au commit `8cdb16d`, 177/224). Nous retenons quatre actions peu coûteuses qui font chacune passer au moins un critère à 2.

| # | Action | Critères | Gain | Ticket |
| --- | --- | --- | --- | --- |
| 1 | Suivre la dette technique : étiquette `dette` et `docs/TECH-DEBT.md` | F4, F5 | +4 | [#312](https://github.com/2iAcademy/rekr-app/issues/312) |
| 2 | Logs backend en JSON avec un `request_id` par requête | J2 | +2 | [#316](https://github.com/2iAcademy/rekr-app/issues/316) |
| 3 | Scan des images Docker avec Trivy dans `ci-cd.yml` | H6 | +2 | [#313](https://github.com/2iAcademy/rekr-app/issues/313) |
| 4 | ADR dans `docs/adr/` pour les choix déjà justifiés dans le dossier | D3, M3 | +2 | [#308](https://github.com/2iAcademy/rekr-app/issues/308) |

Score visé : 187/224 (83 %).

Les autres écarts restent au backlog, dont `CONTRIBUTING.md` (#309), le schéma d'architecture (#310), `CHANGELOG.md` (#311), Hadolint (#314) et gitleaks (#315).
