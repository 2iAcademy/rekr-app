# Le classement du feed candidat

Comment le deck d'un candidat est composé, et pourquoi une offre s'y trouve à
la place où elle est.

Tous les nombres cités ici vivent dans un seul fichier,
[`backend/src/search/ranking/ranking-rules.ts`](../backend/src/search/ranking/ranking-rules.ts).
Le fichier voisin `offer-ranking.ts` ne fait que les traduire en requête
Elasticsearch : il ne contient aucune valeur en dur. Ajuster le classement, c'est
changer un nombre dans le premier fichier — jamais du code.

## Deux mécanismes, à ne pas confondre

**Un filtre retire l'offre du deck.** Réservé aux axes qu'aucun score ne
rattrape : le candidat ne verra jamais cette offre, quelles que soient ses
qualités par ailleurs.

**Un poids ordonne ce qui reste.** Un axe ne retire jamais de points : au pire il
n'en rapporte aucun. Une offre ne peut donc pas passer derrière une autre à cause
d'un champ qu'elle a laissé vide — elle ne gagne simplement rien dessus.

## Ce qui filtre

| Axe             | Règle                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Métier**      | Le candidat ne voit que les métiers qu'il a nommés. S'il n'en a nommé aucun, il voit tout. Une offre sans métier disparaît dès qu'il en nomme un : un métier inconnu n'est pas un joker. |
| **Télétravail** | Filtre sur ce que le candidat peut _tenir_, pas sur une égalité. Voir `REMOTE_AFFINITY`. Ne s'applique que s'il a répondu.                                                               |
| **Contrat**     | Une seule paire est exclue, et la matrice la nomme : l'alternance et le stage sont un statut, pas une préférence.                                                                        |

Dans les trois cas, une offre qui n'a **pas rempli le champ** reste dans le deck —
sauf pour le métier, seul axe où le silence de l'offre l'exclut. Une offre qui
n'a rien dit n'est pas une offre qui dit non.

## Ce qui ordonne

| Axe              | Poids | Pourquoi ce poids                                                                |
| ---------------- | ----: | -------------------------------------------------------------------------------- |
| Compétences      | **5** | Ce qui sépare deux offres du même métier.                                        |
| Métier principal | **2** | Départage, ne trie pas par bloc. Voir ci-dessous.                                |
| Séniorité        | **4** | Un junior sur un poste lead est une candidature perdue des deux côtés.           |
| Contrat          | **3** | Filtrer dessus ampute la moitié du stock d'une agence d'intérim.                 |
| Salaire          | **3** | Mesuré, pas testé : jusqu'où l'offre monte vers l'attente.                       |
| Lieu             | **1** | Une contrainte physique, pas une préférence : ça décide peu, mais ça décide.     |
| Fraîcheur        | **1** | Une annonce de trois mois est souvent déjà pourvue.                              |
| Télétravail      | **0** | N'exclut que. Sa matrice gradue déjà : monter ce poids à 1 active la préférence. |

**Score maximum : 19** (17 pour un candidat qui n'a qu'un métier, ou dont les
métiers n'ont pas de rang).

### Le métier principal

Les métiers restent un **filtre** : les trois passent, aucun n'est préféré à
l'entrée. Le candidat peut ensuite désigner celui qui compte le plus
(`candidate_job_family.rank = 0`) ; ses offres gagnent 2 points, les autres
rien. L'effet est donc sur l'**ordre**, jamais sur ce qui est visible : les
offres des métiers secondaires restent mélangées au deck, un peu plus bas.

Le poids est volontairement **sous celui des compétences**. Une offre d'un métier
secondaire qui utilise toutes les compétences du candidat passe devant une offre
du métier principal qui n'en utilise aucune. Le passer au-dessus de la somme des
autres axes (≥ 18) trierait le deck par bloc, ce qui revient à un second filtre
que le candidat n'a pas demandé.

Aucun principal n'est élu quand il n'y a rien à préférer : un seul métier, ou des
métiers écrits avant l'existence du rang (tous à 0 après la migration, faute
d'intention récupérable). Ces comptes sont classés exactement comme avant tant
que le candidat n'a pas choisi depuis son profil. Voir `primaryJobFamilyOf`.

Le score n'est comparable qu'entre les offres d'un même candidat. Un axe que le
candidat n'a pas renseigné n'émet aucune clause, ce qui abaisse d'autant le
maximum atteignable pour lui — sans effet sur son classement.

## Les trois matrices

### Contrat — `CONTRACT_AFFINITY`

Lecture : `[ce que cherche le candidat][ce que propose l'offre]`. `✗` exclut.

| cherche ↓ / propose → | CDI | CDD | Intérim | Freelance | Alternance | Stage |
| --------------------- | :-: | :-: | :-----: | :-------: | :--------: | :---: |
| **CDI**               |  3  |  2  |    1    |     0     |     ✗      |   ✗   |
| **CDD**               |  3  |  3  |    2    |     0     |     ✗      |   ✗   |
| **Intérim**           |  3  |  3  |    3    |     0     |     ✗      |   ✗   |
| **Freelance**         |  0  |  0  |    0    |     3     |     ✗      |   ✗   |
| **Alternance**        |  ✗  |  ✗  |    ✗    |     ✗     |     3      |   1   |
| **Stage**             |  ✗  |  ✗  |    ✗    |     ✗     |     1      |   3   |

Asymétrique volontairement : qui accepte une mission de trois mois accepte aussi
un CDI, l'inverse n'est pas vrai. Les exclusions, elles, sont **symétriques** —
c'est une partition, et une frontière qui ne couperait que dans un sens laisserait
un recruteur atteindre des candidats que la même règle empêche de l'atteindre.

Un candidat peut cocher plusieurs contrats : c'est la **meilleure ligne** qui
l'emporte, et une offre n'est exclue que si _tous_ ses contrats l'excluent.
Cocher une case de plus élargit le deck, jamais l'inverse.

### Télétravail — `REMOTE_AFFINITY`

| demande ↓ / propose → | Sur site | Hybride | Full remote |
| --------------------- | :------: | :-----: | :---------: |
| **Sur site**          |    3     |    2    |      1      |
| **Hybride**           |    ✗     |    3    |      2      |
| **Full remote**       |    ✗     |    ✗    |      3      |

Contrairement au contrat, c'est un **ordre**, pas une partition — ses exclusions
sont donc délibérément **asymétriques**. Demander du télétravail, c'est le plus
souvent ne pas pouvoir venir sur site (garde d'enfant, proche à charge, domicile
éloigné), et cette impossibilité ne va que dans un sens.

Qui a demandé l'hybride proposait de venir, ne l'exigeait pas : une offre full
remote lui convient. Qui ne peut pas venir du tout n'est pas servi en hybride.
Qui a demandé le sur site n'est contraint par rien et voit tout.

### Séniorité — `EXPERIENCE_AFFINITY`

| candidat ↓ / offre exige → | Junior | Confirmé | Senior | Expert |
| -------------------------- | :----: | :------: | :----: | :----: |
| **Junior**                 |   4    |    2     |   0    |   0    |
| **Confirmé**               |   4    |    4     |   2    |   0    |
| **Senior**                 |   2    |    4     |   4    |   2    |
| **Expert**                 |   2    |    2     |   4    |   4    |

Être surqualifié coûte moins qu'être sous-qualifié : un expert peut tenir un
poste junior, un junior ne tient pas un poste senior.

⚠️ **La colonne Expert est une extrapolation.** La table d'origine s'arrêtait à
Senior. Elle suit l'écart encodé par les trois autres colonnes : même niveau ou
un cran au-dessus → plein ; deux crans ou plus au-dessus → moitié ; un cran en
dessous → moitié ; deux crans ou plus en dessous → rien. À valider.

## Les trois courbes

| Axe             | Formule                                                                                                                                                                                         | Réglages            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **Compétences** | Le poids est **partagé** entre les compétences du profil. Une offre couvrant 2 des 4 compétences du candidat obtient la moitié. Au-delà de 20 compétences, les suivantes ne notent plus.        | `MAX_SCORED_SKILLS` |
| **Salaire**     | Mesuré sur le **haut** de la fourchette de l'offre. Atteint le haut de l'attente → plein ; sous le bas de l'attente → rien ; entre les deux → proportionnel. Une offre sans salaire garde 25 %. | `SALARY_RULES`      |
| **Lieu**        | Décroissance gaussienne : rien perdu sous 10 km, moitié au rayon de mobilité. Un candidat ouvert à toute la France sort l'axe. Une offre sans coordonnées garde 50 %.                           | `LOCATION_RULES`    |
| **Fraîcheur**   | Décroissance gaussienne : rien perdu sous 7 jours, moitié à 45 jours.                                                                                                                           | `FRESHNESS_RULES`   |

Le salaire se mesure sur le haut de la fourchette, et non sur le recouvrement des
deux fourchettes, parce que le recouvrement classait une offre payant **mieux**
que l'attente en dessous d'une offre payant exactement au niveau demandé : face à
un candidat demandant 45–60 k€, une offre à 55–70 k€ ne « couvre » qu'un tiers
d'un intervalle que le candidat n'avait posé que comme un plancher.

## Une trace réelle

Camille, candidate de l'environnement QA : **Informatique** (un seul métier, donc
pas de principal : le maximum reste 17 pour elle), confirmée, cherche un
**CDI**, demande l'**hybride**, attend **45–60 k€**, mobile à **30 km** autour de
**Lyon**, compétences **React** et **TypeScript**.

Sur 58 offres au catalogue, 11 lui sont servies. Les 47 autres sont écartées par
les filtres : un autre métier pour la plupart, une alternance, un poste exigeant
une présence sur site qu'elle ne peut pas assurer.

|   # | Offre                                                            |    Score |   Cmp |   Sén |     Ctr |      Sal |  Lieu |     Frch |
| --: | ---------------------------------------------------------------- | -------: | ----: | ----: | ------: | -------: | ----: | -------: |
|   1 | Développeur front-end React / TypeScript · CDI · 50–60 k€ · Lyon | **17,0** |     5 |     4 |       3 |        3 |     1 |        1 |
|   2 | Développeur front-end **junior** React · CDD · 28–32 k€          | **13,0** |     5 |     4 |       2 |    **0** |     1 |        1 |
|   3 | Développeur full-stack Node.js/Vue.js · CDI · 45–60 k€           | **12,0** | **0** |     4 |       3 |        3 |     1 |        1 |
|   4 | Développeur front-end React · CDD · 38–46 k€                     | **11,2** |     5 |     2 |       2 |  **0,2** |     1 |        1 |
|   5 | Développeur back-end Node.js · publiée il y a 4 mois             | **11,0** |     0 |     4 |       3 |        3 |     1 | **0,01** |
|   6 | Développeur full-stack TypeScript · **Grenoble**                 | **11,0** |     0 |     4 |       3 |        3 | **0** |        1 |
|   7 | Ingénieur DevOps · CDI · **full remote** · 50–65 k€              | **10,0** |     0 |     2 |       3 |        3 |     1 |        1 |
|   8 | **Lead** développeur front-end · CDI · 52–62 k€                  | **10,0** |     0 | **2** |       3 |        3 |     1 |        1 |
|   9 | Développeur back-end Java · CDI · 42–55 k€                       |  **9,0** |     0 |     2 |       3 |    **2** |     1 |        1 |
|  10 | Data analyst · **freelance** · 55–70 k€                          |  **7,0** |     0 |     2 |   **0** |        3 |     1 |        1 |
|  11 | Développeur web · rien de renseigné                              | **6,25** |     0 |     2 | **1,5** | **0,75** |     1 |        1 |

Ce que cette trace montre, ligne à ligne :

- **1** fait le plein : c'est l'optimum, et il est atteignable.
- **5** et **6** sont identiques à un axe près — l'une a quatre mois, l'autre est
  à Grenoble. Chacune perd exactement son point, et pas davantage.
- **7** n'apparaissait pas avant la correction du télétravail. Camille demandait
  l'hybride ; l'égalité stricte lui cachait les deux offres les mieux payées de
  son métier.
- **8** perd 2 points sur la séniorité : poste senior, candidate confirmée.
- **10** est en freelance, ce que Camille ne cherche pas : 0 sur le contrat, mais
  l'offre reste visible — c'est précisément ce que le passage du filtre au poids
  a changé.
- **11** n'a rien rempli et ne tombe pourtant pas à zéro : elle récolte les
  valeurs « non renseigné » et finit dernière, sans être exclue.

### Le point qui reste discutable

**L'offre 2 est deuxième.** Elle paie 28–32 k€ quand Camille en demande 45, elle
est en CDD et vise un junior. Elle arrive là parce qu'elle porte ses deux
compétences (5 points, l'axe le plus lourd) et parce que la matrice note
« Confirmé sur un poste Junior » au maximum (4 points).

Un salaire hors fourchette rapporte 0 mais ne coûte rien. Sur 17 points, ne pas
en gagner 3 n'est pas dissuasif. Deux leviers d'une ligne chacun, si ce
classement n'est pas celui qu'on veut :

- monter `CRITERION_WEIGHTS.salary` ;
- baisser `EXPERIENCE_AFFINITY.CONFIRME.JUNIOR`.

## Quand Elasticsearch est indisponible

Le classement vient d'Elasticsearch, **les filtres non** : ils sont appliqués par
PostgreSQL, qui relit les cartes et reste la seule autorité sur le statut de
l'offre et sur ce que le candidat a déjà vu. L'index ne décide jamais de ce qu'un
candidat a le droit de voir.

Conséquences si le cluster ne répond pas :

- le deck contient **exactement les mêmes offres** — aucune fuite, les trois
  filtres tiennent ;
- mais il est trié **par date de publication**, pas par score.

C'est une limite connue et non résolue. Sur la trace ci-dessus, l'offre à 17
points tombait en cinquième position et l'annonce vide passait première.

La même remarque vaut pour le complément de page : quand l'index a du retard, la
fin du deck est lue directement depuis PostgreSQL. C'est pourquoi les exclusions
du contrat et du télétravail sont exportées (`allowedContractTypes`,
`allowedRemotePolicies`) et appliquées des deux côtés — sans quoi un stage non
encore indexé entrerait dans le deck d'un candidat cherchant un CDI.

## Ce que le classement ignore, et pourquoi

**Le titre et la description.** Support instable : « développeur commercial »
désigne un vendeur. Utile pour une recherche par mots-clés, pas pour un
classement.

**Le score de pertinence d'Elasticsearch.** La requête part d'un score nul et
n'additionne que les points décrits ici (`boost_mode: replace`). Rien de ce qui
ordonne le deck n'est calculé par le moteur : le classement est une décision
produit, et elle est lisible dans un seul fichier.
