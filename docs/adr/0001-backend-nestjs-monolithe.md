# ADR-0001 : backend en monolithe NestJS

Statut : Acceptée

## Contexte

Le frontend React a besoin d'une API pour l'authentification, les offres, le matching et la messagerie. L'équipe compte deux développeurs.

## Décision

Une seule API NestJS (TypeScript), découpée en modules par domaine dans `backend/src/`. Pas de microservices, pas de Next.js côté serveur : l'application n'a pas besoin de rendu serveur.

## Conséquences

- Un seul service à construire, tester et déployer.
- Les modules gardent des frontières claires, ce qui permettrait d'en extraire un plus tard.
- Tout le backend monte en charge d'un bloc.
