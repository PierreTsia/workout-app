# Triage labels — workout-app (GymLogic)

Cinq rôles canoniques, chacun porté par un seul label :

| Rôle | Label | Signification |
|---|---|---|
| À trier | `needs-triage` | pas encore évaluée |
| Manque d'information | `needs-info` | une question est posée au reporter |
| Prêt pour un agent | `ready-for-agent` | assez précise pour être implémentée sans humain |
| Prêt pour un humain | `ready-for-human` | demande une décision ou un geste humain |
| Abandonné | `wontfix` | ne sera pas fait |

À ne pas confondre avec les familles de faits déjà présentes : `type:*`, `priority:*`,
`needs-grilling`, `review:*` (`review:approved`, `review:blocking`, `review:follow-up`,
`review:hitl`) et `routing:*` (posé par le routeur de PR, jamais à la main). Les labels
canoniques absents sont **créés au premier usage** (`gh label create`), jamais dupliqués :
un label existant qui porte déjà le rôle est réutilisé.
