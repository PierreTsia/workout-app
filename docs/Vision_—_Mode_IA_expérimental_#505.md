# Vision — Mode IA expérimental (#505)

Design-first. Pas un Epic Brief, pas un Tech Plan : **le brief de design** du nouvel usage cible de l'agent — et les écrans qui le rendent discutable.

**Issue :** [#505](https://github.com/PierreTsia/workout-app/issues/505) (tête de pont)
**Refs :** [#552](https://github.com/PierreTsia/workout-app/issues/552) (Jev, routeur/gate, derrière) · [#556](https://github.com/PierreTsia/workout-app/issues/556) (porte d'entrée globale — parkée) · [#555](https://github.com/PierreTsia/workout-app/issues/555) (spike routage) · [#503](https://github.com/PierreTsia/workout-app/issues/503) (insight *pendant* l'édition)
**Écrans (visual floor) :** `file:web/stitch/agent-505/`
**Glossaire :** `file:docs/CONTEXT.md` (**Program**, **Session**, **Last Performance**, **Progression Suggestion**, **RIR**, **Exercise Slot**, **Exercise Block**, **Builder**)

---

## 1. Cible

Un **agent qui agit sur le Programme vivant**. Pas une surface de texte de plus.

Il lit ce que l'utilisateur a réellement fait — **Last Performance** + **RIR** sur les **Exercise Slots** du cycle en cours — et il **propose un patch** à la semaine telle qu'écrite (**Template Prescription**). L'utilisateur voit le changement, le comprend, et **valide** ; rien n'est écrit avant son accord.

« Plus qu'un chat » veut dire : **la conversation n'est pas le produit**. Le produit, c'est le patch proposé et sa validation. Si un tour de texte suffit à l'expliquer, le texte est le moyen, pas la fin.

**Ce que ce n'est pas :**

- Pas une surface de chat libre à côté du reste de l'app — c'est **#556**, parkée.
- Pas le chat d'onboarding, pas un quatrième flux de création : cet agent ne crée pas un Programme, il **patche celui qui tourne**.
- Pas l'insight *pendant* l'édition du **Builder** — ça, c'est **#503**. Ici, on est *entre deux séances*, jamais dans la série (invariant **Eyes-off**, #501 / #465).

---

## 2. Pourquoi cet usage, pourquoi maintenant

Deux preuves, pas une intuition :

- Le spike **#555** (PR #558) a tué la première hypothèse : **0 % d'intents routables** dans le chat d'onboarding (0/10 transcripts réels). Le routeur Jev n'a pas d'historique sur quoi mordre en onboarding — les utilisateurs y sont neufs. On ne construit donc pas la route Jev sur l'onboarding.
- **#505** le dit déjà : *« Creation-only AI is a funnel feature. In-program AI is the product. »* Un **Builder** plus joli, Hevy le copiera. Un agent qui patche *cette* semaine à partir de ce qui a été réellement soulevé, non.

L'agent in-program est le seul usage où l'agent a **quelque chose de vrai à lire** (un historique, un programme actif) et **quelque chose d'utile à écrire** (un patch borné, réversible).

---

## 3. Le parcours

1. **Entrée** — depuis le Programme, l'agent est joignable. Il part du **Programme vivant**, pas d'une page blanche. (L'entrée globale — porte, voix — est l'aval #556, pas ce brief.)
2. **Lire** — l'agent résume l'état honnête : ce que dit la **Progression Suggestion** déterministe, où ça stagne, ce que le **RIR** raconte. Pas de chiffre inventé.
3. **Répondre** (explain-only) — à « pourquoi HOLD ? », l'agent **explique** sans rien proposer. C'est le **défaut** : expliquer d'abord.
4. **Proposer** (patch) — quand il a assez, l'agent propose un **patch lisible** : quelles **Exercise Slots**, quoi change (reps / poids / séries), pourquoi. Avant / après, pas un JSON.
5. **Valider** — un **commit gate** explicite. L'utilisateur applique, modifie ou refuse. **Rien n'est écrit sans accord** (même principe que le **Onboarding program commit gate**).
6. **Après** — le patch appliqué est **réversible** (undo), et l'agent ne re-propose pas en boucle.

---

## 4. Hypothèses explicites (à confirmer, pas des faits)

#505 laisse volontairement ces points **non figés**. Le design part de ces hypothèses — elles doivent être tranchées avant tout Tech Plan :

| # | Hypothèse de design | Alternative si fausse |
| --- | --- | --- |
| H1 | **Explain d'abord, patch ensuite.** Le défaut d'un tour est l'explication ; le patch est un second mouvement, déclenché par l'utilisateur ou une confiance haute. | Patch direct dès qu'une **Progression Suggestion** existe. |
| H2 | **Le patch écrit par `update_program`**, borné aux **Template Prescription** (`reps` / `weight` / `sets` / `target_duration_seconds`), slot par slot. Pas de réécriture de la structure du jour, pas d'ajout/suppression d'**Exercise Block**. | Périmètre plus large (ajout de mouvements) — reporté. |
| H3 | **Un `purpose` de thread dédié** (ex. `'coach'`), consentement distinct, pas une réutilisation d'`additional_program`. | Nouvelle table si le cycle de vie diverge. |
| H4 | **Quota** : l'agent in-program ne partage pas le budget one-shot de l'onboarding ; source dédiée. | Héritage du quota `embedded_chat` — à éviter. |
| H5 | **Relation à #503** : #503 = insight pendant l'édition ; ceci = action entre séances. Pas de doublon, deux surfaces. | Fusion des deux — explicitement rejetée par #505. |

Ce sont les questions d'un **grill** que #505 appelait et qui n'a pas eu lieu : elles restent ouvertes, ici écrites noir sur blanc pour qu'on ne les découvre pas dans les écrans.

---

## 5. Les écrans (visual floor)

`file:web/stitch/agent-505/` — HTML, patron `file:web/stitch/builder-503/` (sombre, cadre 390×884, tokens GymLogic). **Floor visuel, pas pixel-slave.**

| Écran | Ce qu'il montre |
| --- | --- |
| `agent-ask.html` | L'entrée depuis le Programme + une réponse **explain-only** (« pourquoi HOLD ? ») — le chemin par défaut, sans patch. |
| `agent-proposal.html` | Le **patch proposé** : avant / après slot par slot, la raison, le **commit gate**. |
| `agent-committed.html` | Après validation : confirmation, résumé du patch appliqué, **undo**. |

Copie FR/EN à traiter en recette (skill **microcopy**) — ici l'anglais fait office de floor.

---

## 6. Hors scope / pièges

- **Pas de chat in-set.** Jamais pendant la série — c'est le mode d'échec Bookends (#465 / #501).
- **Pas de génération de programme.** Cet agent patche un Programme existant ; il n'en crée pas (ça reste onboarding / additional-program).
- **Pas de porte globale ici.** Entrée, voix, montage global = #556, parkée.
- **Pas de patch silencieux.** Tout passe par le commit gate. Un agent qui écrit `dry_run:false` dans le même tour est le bug que #287 traque.
- **Pas de faux chiffres.** L'agent lit **Last Performance** / **RIR** ; il n'invente pas de progression. La **Progression Suggestion** déterministe reste la source de vérité, l'agent l'explique et la patche.

---

## 7. Décisions ouvertes (HITL)

1. **H1** — explain-only par défaut, ou patch direct ? (recommandé : explain d'abord)
2. **H2** — périmètre exact d'écriture du patch (quels champs, `update_program` vs outil dédié).
3. **H3** — `purpose` dédié vs nouvelle table ; forme du consentement.
4. **H4** — famille de quota de l'agent in-program.
5. **H5** — frontière nette avec #503, confirmée.
6. **Surface d'entrée v0** — part-on du **Programme** (raccourci local) avant la porte globale #556 ?

---

## Evidence

- **Spike #555** (PR #558) : **0 % d'intents routables** en onboarding (0/10, transcripts réels) ; seuil ~20–24 %. → ne pas router l'onboarding ; chercher la valeur là où il y a un historique.
- **#505** (corps de l'issue) : « In-program AI is the product » ; v1 **entre séances**, jamais pendant la série ; job = expliquer / proposer un patch, l'utilisateur confirme.
- **#552** : Jev = verdicts only ; le consentement d'écriture MCP exige un **état serveur** (preview + match du payload), pas un Noul sur un payload auto-raconté (réconciliation #287).
- **État du repo (vérifié)** : `update_program` existe côté MCP ; pas de `purpose` de thread pour un programme déjà commité ; `EmbeddedAgentChatStep` monté uniquement dans onboarding / additional-program.
