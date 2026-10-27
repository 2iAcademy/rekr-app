# ADR-0003 : Elasticsearch pour le fil candidat

Statut : Acceptée

## Contexte

Le fil candidat filtre et classe les offres selon le profil (compétences, séniorité, contrat, salaire, lieu). Un benchmark a comparé la même requête sur Elasticsearch et sur PostgreSQL, de 58 à 100 000 offres.

| Offres | PostgreSQL p50 | Elasticsearch p50 |
| --- | --- | --- |
| 1 000 | 3 ms | 4,7 ms |
| 2 000 | 5 ms | 4,2 ms |
| 10 000 | 18,3 ms | 5,7 ms |
| 100 000 | 149,8 ms | 11,6 ms |

Les deux renvoient le même top 20. PostgreSQL est plus rapide en dessous d'environ 2 000 offres, Elasticsearch au-delà.

## Décision

Le classement passe par Elasticsearch, avec repli sur PostgreSQL si Elasticsearch est indisponible ou désactivé (`ELASTICSEARCH_ENABLED=false`). Les règles de classement sont détaillées dans [`docs/ranking-du-feed-candidat.md`](../ranking-du-feed-candidat.md).

## Conséquences

- Le temps de réponse reste stable quand le nombre d'offres augmente.
- Elasticsearch occupe environ 1 Go de mémoire, ce qui impose un swap sur le VPS.
- PostgreSQL reste la source de vérité : l'index se reconstruit à partir de la base.
