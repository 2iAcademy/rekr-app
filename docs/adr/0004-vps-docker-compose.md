# ADR-0004 : un VPS avec Docker Compose

Statut : Acceptée

## Contexte

Le projet a un budget quasi nul et un trafic faible.

## Décision

Toute la production tourne sur un seul VPS Hetzner Cloud (2 Go de RAM, 11,95 € par mois), décrite par `compose.prod.yml` : Caddy, backend, migrate, PostgreSQL, Elasticsearch. Caddy est le seul service exposé et gère HTTPS. Pas de Kubernetes ni de service managé.

## Conséquences

- Un seul fichier décrit la production, et la CI déploie par SSH.
- Le serveur est un point unique de panne : les sauvegardes de nuit et la sauvegarde Hetzner du disque couvrent la perte de données, pas l'indisponibilité.
- Procédure complète dans [`docs/deploiement-vps.md`](../deploiement-vps.md).
