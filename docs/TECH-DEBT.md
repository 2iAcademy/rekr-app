# Dette technique

Chaque dette a un ticket portant l'étiquette [`dette`](https://github.com/2iAcademy/rekr-app/issues?q=label%3Adette). Une dette remboursée sort de ce tableau quand son ticket est fermé.

| Dette | Impact | Ticket |
| --- | --- | --- |
| Pas de CSP sur le front (`docker/caddy/Caddyfile`) | Une faille XSS n'est pas contenue, et le front peut être affiché dans une iframe tierce | [#319](https://github.com/2iAcademy/rekr-app/issues/319) |
| `RouteGuard` ne garde pas la page demandée avant la connexion | L'utilisateur revient sur sa page d'accueil au lieu de la page voulue | [#320](https://github.com/2iAcademy/rekr-app/issues/320) |
| L'export des données (`GET /api/account/export`) n'inclut pas les messages Stream Chat | La copie des données personnelles est incomplète (RGPD) | [#321](https://github.com/2iAcademy/rekr-app/issues/321) |
| Les sauvegardes de nuit restent sur le disque du VPS | Perdre le serveur fait perdre les données | [#322](https://github.com/2iAcademy/rekr-app/issues/322) |
| Une seule sonde de santé, sans distinction vivant / prêt | Une base indisponible et un backend planté se confondent | [#323](https://github.com/2iAcademy/rekr-app/issues/323) |
