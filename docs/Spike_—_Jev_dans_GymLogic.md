# Jev dans GymLogic

Note d'introduction — pendant GymLogic de `mijote docs/spike/Jev_dans_Mijote.md`. Elle pose **une** question structurante — **tranchée le 28/09** (issue #552, ADR `file:docs/adr/0023-jev-verdicts-only-embedded-agent.md`) — et quatre tranches ordonnées. Ce n'est pas un Tech Plan : les tranches restent à découper.

Le vocabulaire Jev est celui de la note mijote et ne change pas ici : un **Noul** est la probabilité qu'un oui/non soit vrai, une **Choice** est un jeu d'options qui somment à 1, un **Score** est une note sur une échelle ordonnée. Un seul passage pose les questions ; le code ouvre une seule branche. Même wire : `POST https://opencode.ai/zen/v1/systemone`, Bearer, `JEV_MODEL`.

## Ce que GymLogic a déjà

Rien de tout ce qui suit n'est à construire — c'est l'état du dépôt aujourd'hui, et c'est ce qui rend la question sérieuse plutôt que théorique.

- **Embedded Agent** (`file:supabase/functions/embedded-agent/`) : threads persistés (`open` | `preview_ready` | `committed` | `abandoned`), deux `purpose` (`onboarding`, `additional_program`), un tour = **un appel modèle** (Gemini 2.5 Flash, repli Groq llama-3.3-70b). Le modèle émet `READY_FOR_PROGRAM_DRAFT: {…}`, le `draft` valide, l'utilisateur voit un preview, le commit passe par le *commit gate*.
- **Quick Workout AI** : deux Edge Functions séparées, `generate-quick-workout` (preview, idempotent, brûle le quota `quick_workout`) et `commit-quick-workout` (mutateur, appelle `create_workout_day` en `dry_run: false` avec le JWT de l'utilisateur). Le patron « preview puis commit » est donc déjà là, deux fois.
- **MCP** : **11 outils** (huit lectures, trois écritures — `create_program`, `update_program`, `create_workout_day`, `get_training_stats`, `get_workout_history`, `list_programs`…), plus une resource, et `dry_run: true` par défaut sur les écritures.
- **Providers IA centralisés** (`file:supabase/functions/_shared/aiProviders.ts`) : le gabarit de wire à copier pour un client Jev.
- **Contexte résolu serveur, déjà disponible** : programme actif, cycle, jour courant, dernière séance, statistiques d'entraînement — `get_training_stats`, `get_workout_history` et `list_programs` répondent déjà la vérité sur la base.

## Ce qui manque, et pourquoi ça compte

1. **Chaque tour paie le modèle.** « Combien de volume dos cette semaine ? » traverse Gemini alors que `get_training_stats` sait répondre. « Je commence ma séance » ne devrait pas coûter un tour de chat.
2. **Aucun consentement d'écriture côté MCP.** L'app a son *commit gate* ; le MCP non — #287 documente des agents qui basculent `dry_run: false` dans le même tour, sans étape de consentement humain.
3. **Un appel MCP ne porte aucun contexte d'écran.** Le serveur ne sait pas où l'utilisateur en est, et rien ne l'empêche de croire l'agent sur parole.

## Piste A — la porte du chat embarqué

Le même principe que mijote : **une phrase n'a pas de sens toute seule, l'état dit où on est.** Ici l'état est : l'écran (Workout, Builder, Programme, Historique, Profil, Onboarding), le thread ouvert et son statut, le programme actif et son jour courant, la dernière séance loggée.

Un passage unique au début de `/send`, avant `callChatGemini` : un **Noul** `hijack`, une **Choice** `intent`.

- **`ask_progress` / `ask_history`** — la base répond (`get_training_stats`, `get_workout_history`, `list_programs`), **zéro modèle**. C'est le gain le plus direct, et il ne demande aucun arbitrage produit.
- **`start_session`** — ouvre Workout. Pas de texte généré.
- **`log_set`** — « 3×8 au bench à 80 » : le contrôle de saisie déjà là s'ouvre, le code lit la série dans la phrase comme il lit une durée. Rien n'est écrit avant validation sur le contrôle.
- **`program_draft`** — le flux actuel, **inchangé** (prompt + `READY_FOR_PROGRAM_DRAFT` + commit gate).
- **`question`** — tout le reste, seule autre branche qui appelle le modèle.
- **`block`** — Noul `hijack` au-dessus du seuil, ou confidence de la Choice trop basse : l'écran ne change pas, le modèle n'est pas appelé.

## Piste B — le consentement d'écriture, côté MCP

Le verdict ne porte pas sur la phrase mais sur le **draft structuré**. Là où mijote vérifie une photo, GymLogic vérifie une charge : les jours inchangés sont-ils bien ré-échoés (les omettre = supprimer), les identifiants sont-ils tous résolus par le serveur, le programme actif est-il épargné, la séance ad-hoc ne touche-t-elle pas l'historique ? Un **Noul** de consentement explicite (l'utilisateur a-t-il confirmé *ce* payload) manque aujourd'hui côté MCP, alors que l'app le pratique déjà en deux phases.

C'est le rattachement naturel de **#287**, et c'est la tranche où une erreur coûte le plus cher.

## Piste C — la « photo » version MCP

Un appel MCP ne porte pas d'écran. L'équivalent honnête n'est pas d'en inventer un, c'est de **résoudre le contexte côté serveur** et de le joindre au verdict : programme actif, cycle, jour courant, dernière séance, profil d'équipement. Même patron que le titre **AUTORITAIRE** de mijote #113 : le serveur ne laisse jamais l'appelant affirmer ce que la base sait.

## La question qui commande tout

**Jev entre par l'app ou par le MCP ?** Ce ne sont ni les mêmes utilisateurs, ni le même gain, ni le même coût d'erreur.

| | Entrée par l'app (Piste A) | Entrée par le MCP (Pistes B/C) |
|---|---|---|
| Utilisateur | l'athlète, dans le chat embarqué | un agent tiers (Claude, Cursor…) qui écrit dans la base |
| Gain | tours de modèle évités, réponses honnêtes de la base | rayon d'impact des écritures tierces maîtrisé |
| Coût d'un verdict faux | un écran qui ne s'ouvre pas — récupérable | une écriture légitime bloquée, ou une mauvaise écriture passée |
| Dépend de | rien | une décision produit sur le consentement (#287) |

**Décidé (28/09, issue #552, ADR `file:docs/adr/0023-jev-verdicts-only-embedded-agent.md`)** : entrée par l'app — **Piste A** — première tranche réduite à `ask_progress` / `ask_history`, zéro modèle. `start_session` et `log_set` viendront après, avec leur propre review. Le MCP attend la décision de consentement (tranche 2), et Jev ne génère jamais de texte.

## Livraison

1. **La porte du chat embarqué.** Un passage, `ask_progress` / `ask_history` sans modèle, `start_session`, puis `log_set`, `program_draft` inchangé, `block`. Ne dépend de rien.
2. **Le consentement d'écriture MCP.** Verdict sur le payload + signal explicite. Rattache #287.
3. **La photo MCP.** Contexte résolu serveur joint au verdict (programme actif, cycle, jour, dernière séance).
4. *(option)* **La porte des écritures MCP.** Verdict avant `create_program` / `update_program` / `create_workout_day` — le pendant de `search_in_recipe` et `add_shopping_item` à mijote.

## Prérequis bloquant

Le credential `system_one` (Zen) répond **401** aujourd'hui — vérifié le 28/09. Aucune tranche ci-dessus n'est exécutable avant réparation du credential ou choix d'un autre modèle : sans verdict, il ne reste que le facts-only, c'est-à-dire pas de porte du tout. À noter : Jev sert **déjà** GymLogic côté ops (`ai-issue-routing/examples/gymlogic.yaml` pour le triage des issues, le PR desk) — le wire et les cookbooks existent, c'est le chemin *produit* qui manque.

## Hors de cette note

La refonte de l'agent embarqué (streaming, prompts, quotas), XState, un **Score** de charge ou de progression, le moteur de progression lui-même, les seuils chiffrés, et la fermeture de #287 sans décision produit. La note mijote `docs/spike/Jev_dans_Mijote.md` n'est pas un gabarit à copier : elle décrit un chat unique avec des composants à ouvrir, là où GymLogic a un agent à deux `purpose` et une surface MCP. Seul le principe se transporte.