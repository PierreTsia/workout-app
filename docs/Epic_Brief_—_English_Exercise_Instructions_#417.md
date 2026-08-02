# Epic Brief — English Exercise Instructions (#417)

## Summary

Rendre le **corps des consignes d'exercice** lisible en anglais, alors que le panneau de détail est aujourd'hui à moitié traduit : les titres de section (« Setup », « Movement ») passent par i18next, le contenu reste français sur les **372 lignes** du catalogue. Le stockage mire le précédent `name_en` — une colonne `instructions_en` nullable — et la résolution se fait **à l'affichage**, conformément à l'**ADR 0010**, en réemployant la forme exacte de `resolveExerciseName` (`file:src/lib/catalogLabels.ts`). Le point central de l'epic n'est pas la traduction : elle est mesurée à **0,40 $ et neuf minutes** pour tout le catalogue. Le coût réel est la **relecture humaine de 4 140 phrases**, qui exige un relecteur trilingue français / anglais / coaching. Toute la conception vise donc à réduire ce que doivent lire des yeux humains : couverture partielle érigée en état d'arrivée valide grâce au repli, priorisation par usage réel mesuré, et **contre-relecture par un second modèle** qui ordonne la file au lieu de la certifier. Invariant de sécurité : une ligne signalée et non validée **reste en français**, parce qu'une consigne fausse en anglais a l'air autorisée là où le français signalait « ce n'est pas pour toi ».

---

## Context & Problem

**Who is affected:** Les utilisateurs anglophones, arrivés majoritairement par **MCP**. Signalé de l'extérieur par un contributeur sur [#417](https://github.com/PierreTsia/workout-app/issues/417), capture d'écran à l'appui, en même temps que [#415](https://github.com/PierreTsia/workout-app/issues/415) dont l'epic est livré.

**Current state:**
- Les **372 lignes** du catalogue ont des instructions, toutes en français, dans un JSONB à quatre clés (`setup`, `movement`, `breathing`, `common_mistakes`) — **4 140 phrases**, **299 914 caractères**, 806 caractères par exercice en moyenne (mesuré).
- Le panneau `file:src/components/exercise/ExerciseInstructionsPanel.tsx` traduit ses **titres** de section par `t()` et rend le **corps** brut depuis `exercise.instructions`. Le mixte est donc dans un même écran.
- Aucune colonne `instructions_en`. `Exercise.instructions` est typé `ExerciseInstructions | null` dans `file:src/types/database.ts`.
- Depuis la livraison de #415, l'interface est **intégralement anglaise** pour un anglophone — noms, muscles, matériel. Les consignes sont le **dernier îlot français**, et il est plus voyant qu'avant précisément parce que tout le reste a été traduit.
- Le pipeline qui a produit le français existe (`file:scripts/enrich-instructions.ts`, Groq `llama-3.3-70b`), mais son prompt est **français en dur** et il **génère** au lieu de traduire. Il n'est pas réemployable tel quel.
- L'usage est **fortement concentré** : sur 372 lignes de catalogue, **141 seulement ont déjà été loguées**. Les 60 premiers exercices portent **76,7 %** des séries enregistrées, les 40 premiers **61,8 %**, les 20 premiers **41,1 %**. **231 exercices n'ont jamais été logués par personne.**
- Une surface de relecture admin existe déjà (`file:src/pages/AdminReviewPage.tsx`), mais son `reviewed_at` est **partagé** avec l'enrichissement d'images : valider une traduction dessus sortirait l'exercice de la file de revue de contenu sans que personne ne l'ait relu. Et chaque outil admin est une **route sœur** (`/admin/review`, `/admin/enrichment`, `/admin/feedback`), jamais un onglet.

**Ce que le spike a établi (mesuré, pas supposé) :**
- **Gemini 2.5 Flash** sur un échantillon aléatoire de 30 lignes tiré à la graine, dont la moyenne colle au catalogue à +1,7 % : **29/30 réellement propres**, un seul défaut de contenu réel (« largeur des épaules » devenu *hip-width*), **zéro inversion de mode** sur 107 entrées d'erreurs courantes, **98 %** de cohérence en deuxième personne.
- **DeepL est écarté**, glossaire ou non : 25 inversions de mode sur 42 entrées — un impératif sous un titre « Common mistakes » ordonne de commettre la faute — plus « décliné » traduit par *incline* sur un exercice nommé *Decline Bench Leg Raise*. Son glossaire est aveugle au contexte et a même inséré des caractères qu'aucun token source ne justifiait.
- Le filet automatique **sur-signale** : 2 alertes sur 3 étaient des faux positifs (« pupitre Larry Scott » est bien un *preacher bench* ; « Lower back to 90° » où *lower* est un verbe).

**Pain points:**
| Pain | Impact |
|---|---|
| Corps des consignes FR imposé | Un anglophone lit un titre « Setup » suivi de « Allongez-vous sur le banc… » dans le même panneau |
| Dernier îlot après #415 | Le contraste est maximal : tout l'écran est anglais sauf la seule zone de coaching réel |
| Coût réel = relecture, pas génération | 4 140 phrases à relire contre 0,40 $ de traduction — se tromper de levier condamne l'epic |
| Relecteur unique non substituable | Valider « largeur des épaules » exige FR + EN + coaching ; impossible à sous-traiter à un traducteur |
| Consigne fausse en anglais | Elle a l'air autorisée, là où le français signalait implicitement « ce n'est pas pour toi » |
| Filet bruyant | Un garde-fou à 2 faux positifs sur 3 consomme le temps de relecture qu'il prétend économiser |
| Relecture en un bloc | Une tâche qui exige plusieurs heures d'affilée ne se termine jamais |

---

## User Stories

1. As an **English-speaking user**, I want the **instruction body in English** on the exercise details panel when my Display Locale is EN, so that the panel stops mixing an English heading with French coaching text.
2. As an **English-speaking user** viewing an exercise **not yet translated**, I want the French instructions shown rather than an empty panel, so that partial coverage is invisible rather than broken.
3. As an **English-speaking user** viewing an exercise whose translation was **flagged and not yet human-approved**, I want the **French** shown, so that I am never handed a suspect form cue that looks authoritative.
4. As a **French-speaking user**, I want **nothing to change** in what I read, so that translating for others is not a regression for the default audience.
5. As the **reviewer**, I want a queue that puts **flagged rows first, then unreviewed rows ordered by real usage**, so that my scarce attention lands on the exercises people actually perform.
6. As the **reviewer**, I want French and English shown **sentence-aligned side by side**, with the cross-checker's objection attached to the offending sentence, so that I can judge without reconstructing the mapping myself.
7. As the **reviewer**, I want to **approve, edit, or revert to French** per row from the keyboard, so that a pass is fast and resumable in ten-minute chunks.
8. As the **reviewer**, I want a button that **copies a review request** — source, translation, objection, and the house style rules — so that I can adjudicate a hard case with an agent instead of alone.
9. As the **reviewer**, I want to **paste a corrected JSON back**, shape-validated and diffed before saving, so that a malformed answer cannot silently corrupt a row.
10. As the **reviewer**, I want my decision recorded with a timestamp, so that a second pass never re-presents what I already approved.
11. As a **maintainer**, I want the backfill script to be **idempotent** and fill only `NULL` rows, so that re-running it is safe by construction.
12. As a **maintainer**, I want each row to record **which model and prompt version** produced it, so that a future re-run is diffable rather than a mystery.
13. As a **maintainer**, I want to run the backfill **in waves** — never-logged rows first, then the top N by usage, or explicit ids — so that I control blast radius and get feedback on a low-stakes lot.
14. As a **maintainer**, I want a **second model to cross-check each sentence pair** for semantic equivalence, so that measurement changes like "shoulder-width → hip-width" are caught, which regex cannot see.
15. As a **maintainer**, I want the gate's **known false positives fixed** before it orders the queue, so that it does not burn the reviewer's trust on its first use.
16. As a **maintainer**, I want the resolution rule implemented **once** and consumed by every surface, so that it cannot drift the way the Catalog Snapshot write paths did.
17. As a **maintainer**, I want **partial coverage to be a supported state**, so that an unfinished backfill is a status, not an incident.
18. As an **admin creating a catalog exercise** with French instructions only, I want it displayed as typed in both locales, so that unfinished catalog rows degrade gracefully.

### Success measures
| Story # | Measure |
|---|---|
| 1 | **0 phrase française** rendue dans le corps pour `locale = en` sur une ligne au statut `approved` ou `clean` |
| 2, 3, 18 | Matrice de repli couverte par test : `instructions_en` nul, statut `flagged`, statut `clean`, statut `approved` |
| 4 | **0 changement** de ce qui est rendu pour `locale = fr`, quel que soit le statut |
| 5 | La file place les `flagged` avant les `clean`, et trie les `clean` par nombre de séries loguées décroissant |
| 11 | Deux exécutions consécutives du script produisent **0 écriture** sur la seconde |
| 14 | Le défaut « largeur des épaules → hip-width » du spike est **attrapé** par la contre-relecture sur un test de régression |
| 15 | Les deux faux positifs connus (synonyme de matériel, verbe *lower*) ne se déclenchent plus |
| — | **≥ 76 %** de l'exposition réelle (séries loguées) couverte par des lignes `approved` à la clôture de l'epic |

---

## Scope

**In scope:**
1. Colonne `instructions_en` + statut + horodatage de relecture + modèle, et la résolution à l'affichage câblée dans le panneau de détail.
2. Script de backfill par vagues : traduction Gemini 2.5 Flash, filet automatique corrigé, **contre-relecture par un second modèle**, écriture du statut.
3. Route admin sœur `/admin/translations` : file priorisée, comparaison alignée, validation clavier, puis — livré séparément — presse-papier de demande d'arbitrage et collage validé du correctif.
4. Backfill effectif sur **tout le catalogue**, en vagues : longue traîne d'abord, puis les 60 premiers par usage relus à la main.

**Out of scope:**
- **MCP** (`get_exercise_details` et consorts) : l'issue le mentionne, mais la locale côté MCP est le chantier de [#422](https://github.com/PierreTsia/workout-app/issues/422) v1.5, conditionné à une mesure de production. Aucune raison de le rouvrir ici.
- Retraduction ou correction du **français** existant, même quand la contre-relecture révèle que la source est fautive : signalé, pas corrigé.
- Noms et descriptions de **templates de programme** ([#58](https://github.com/PierreTsia/workout-app/issues/58)) — même forme de problème, epic distinct.
- Toute mémoire de traduction, framework générique d'i18n de contenu, ou éditeur bilingue.
- Restructuration en `instructions: { fr, en }` : casse le précédent `name_en` et impose une migration de données pour aucun gain.
- Relecture humaine exhaustive des 372 lignes.

---

## Success Criteria

- **Numérique :** ≥ 76 % de l'exposition réelle mesurée en séries loguées est servie par des instructions anglaises **relues par un humain**.
- **Numérique :** 0 ligne au statut `flagged` n'est jamais rendue en anglais.
- **Numérique :** le script est idempotent — seconde exécution à 0 écriture.
- **Qualitatif :** un anglophone ouvrant le détail d'un exercice courant ne voit plus une seule phrase française, et un francophone ne voit aucun changement.
- **Qualitatif :** un backfill inachevé est un état documenté et sans incident, pas une dette bloquante.
