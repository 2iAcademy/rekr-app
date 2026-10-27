# ADR-0002 : PostgreSQL avec Prisma

Statut : Acceptée

## Contexte

Les données sont relationnelles : utilisateurs, profils, sociétés, offres, likes, matches. La messagerie, elle, passe par Stream Chat.

## Décision

PostgreSQL comme base unique, avec Prisma comme ORM. Le schéma est dans `backend/prisma/schema.prisma` et les migrations sont versionnées dans le dépôt.

## Conséquences

- Le client Prisma est typé à partir du schéma.
- En production, le service `migrate` applique les migrations (`prisma migrate deploy`) avant le démarrage du backend.
- Les tests backend tournent contre une vraie base PostgreSQL en CI.
