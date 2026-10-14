# Modérer un compte ou une offre — production Rekr

Rekr n'a pas encore de back-office : le tableau de bord administrateur est un _Could have_ du cahier des charges,
reporté en V2. Cette fiche dit comment, en attendant, tenir l'engagement des conditions d'utilisation (« un compte
qui enfreint ces conditions peut être désactivé ») et retirer une offre frauduleuse. Tout passe par `psql`, sur le
serveur, depuis un compte nominatif (voir les repères du [runbook](runbook.md)).

Légende : ✅ requête et effet vérifiés sur la pile de développement, dont le schéma est celui de la production ·
⚠️ vérifiable en vraie production seulement.

## Ce que l'application fait déjà

- **Compte désactivé** (`"user".is_active = false`) : le garde d'authentification recharge l'utilisateur à chaque
  requête, donc même un jeton déjà émis reçoit `403 This account is inactive.` dès la requête suivante. La
  connexion et le renouvellement de session sont refusés de la même façon. Les données restent en base : la
  désactivation se défait.
- **Offre retirée** (`offer.status` autre que `open`) : le fil, les likes et les listes de matchs ne lisent que
  les offres `open`, et PostgreSQL filtre en dernier, même quand Elasticsearch a classé l'offre. Elle disparaît
  donc du fil à la requête suivante.

## Ouvrir psql

```bash
cd /opt/rekr
alias dc='docker compose -f compose.prod.yml'
dc exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'   # ⚠️
```

Chaque `UPDATE` ci-dessous finit par `RETURNING` : il affiche ce qu'elle a changé. Zéro ligne affichée veut dire
que rien n'a changé (adresse ou identifiant faux).

## 1. Désactiver un compte

```sql
-- Retrouver le compte (✅)
SELECT id, email, user_type, is_active, last_active_at FROM "user" WHERE email = 'adresse@exemple.fr';

-- Le désactiver (✅)
UPDATE "user" SET is_active = false WHERE id = 1234 RETURNING id, email, is_active;
```

**Vérification** : une requête de ce compte avec un jeton émis avant la désactivation répond `403` (✅).

Un recruteur désactivé ne se connecte plus, mais **ses offres restent dans le fil**. Si elles sont en cause, les
fermer aussi (fiche 3).

## 2. Réactiver un compte

```sql
UPDATE "user" SET is_active = true WHERE id = 1234 RETURNING id, email, is_active;   -- ✅
```

**Vérification** : la connexion répond de nouveau `200` (✅).

## 3. Fermer une offre

```sql
-- Retrouver l'offre et son entreprise (✅)
SELECT o.id, o.title, o.status, c.name AS entreprise
FROM offer o JOIN company c ON c.id = o.fk_company
WHERE o.title ILIKE '%mot du titre%';

-- La fermer (✅)
UPDATE offer SET status = 'closed' WHERE id = 567 RETURNING id, title, status;

-- Ou fermer toutes les offres publiées d'une entreprise (✅)
UPDATE offer SET status = 'closed' WHERE fk_company = 89 AND status = 'open' RETURNING id, title;
```

**Vérification** : l'offre n'apparaît plus dans le fil d'un candidat qui la voyait (✅).

Pour la remettre en ligne : `UPDATE offer SET status = 'open' WHERE id = 567 RETURNING id, title, status;` (✅).

## Limites de la procédure

Une requête SQL ne passe pas par l'API, donc pas par ce qui accompagne d'habitude un changement :

- **Index Elasticsearch** : l'offre fermée y reste jusqu'au prochain recalage (au démarrage du backend ou après
  une erreur d'Elasticsearch, voir la fiche 5 du runbook). Sans effet visible : PostgreSQL l'écarte du fil.
- **Conversations** : l'API gèle les conversations d'une offre fermée. Fermée en SQL, chaque conversation est
  gelée chez Stream à sa prochaine ouverture. Un compte désactivé garde son jeton Stream jusqu'à son expiration,
  une heure au plus.
- **Traçabilité** : rien n'enregistre qui a fait quoi. Le dépôt est public : n'y écrire ni adresse e-mail ni
  nom. Garder la date, l'identifiant et le motif hors du dépôt.

Le back-office de la V2 remplacera ces requêtes par des routes de l'API réservées au rôle `admin`, qui passeront
par les mêmes services que l'application.
