# T160 — Review assist clipboard round-trip

## Goal

Rendre l'arbitrage d'un cas difficile rapide au lieu de solitaire. Un bouton copie une **demande d'arbitrage** complète — noms de l'exercice, phrases numérotées et alignées, objections du contre-relecteur, règles maison — que le relecteur soumet à un agent ; le retour se recolle dans l'écran, sa forme est validée, et un diff par section précède toute écriture.

Le levier est bien identifié : le coût de cet epic n'est pas la traduction (0,40 $ et neuf minutes pour tout le catalogue) mais la relecture de 4 140 phrases par un relecteur trilingue non substituable. Ce ticket ne rend pas la relecture possible, il la rend tenable.

Couvre les stories 8 et 9 de l'Epic Brief.

## Mode

**AFK** — construire le dialog est mécanique. C'est son usage qui est humain, et cet usage vit dans T161.

## Slice

`buildReviewRequest` pur → `ReviewAssistDialog` → presse-papier → validation de forme → diff → vitest

## Dependencies

T159 (le chemin d'écriture et l'édition minimale qu'il remplace).

## Scope

### Construction de la charge

`buildReviewRequest(row)` est une **fonction pure dans `src/lib/`**, donc testée sans rendu. Elle produit un texte portant :

- Le nom français et le nom anglais de l'exercice, pour que l'arbitre sache de quel mouvement on parle.
- Les quatre sections, chaque phrase **numérotée** et appariée à sa source française, pour que le retour soit réalignable sans deviner.
- Les objections du contre-relecteur, avec leur verdict et leur note, référencées par section et index.
- Les **règles maison**, celles-là mêmes que le prompt de traduction applique : phrase nominale pour les erreurs courantes (un impératif sous « common mistakes » ordonne de commettre la faute), deuxième personne constante, fidélité du matériel et des mesures.
- La consigne de rendre un **JSON corrigé** dans la forme attendue, pas un commentaire.

La demande demande un arbitrage et une correction, pas une validation : « dis-moi si c'est bon » produit un avis, « corrige ce qui doit l'être et rends le JSON » produit quelque chose de collable.

### Presse-papier

Repli à trois niveaux, exactement celui de `file:src/components/ErrorFallback.tsx` : `navigator.clipboard.writeText`, puis un `textarea` hors écran avec `execCommand`, puis dépôt du texte dans un toast long comme le fait `file:src/components/admin/review/ExerciseReviewToolbar.tsx` pour ses prompts d'illustration. Un contexte non sécurisé ne doit pas être un cul-de-sac.

### Collage retour

Le JSON collé passe par `parseInstructions` de `src/lib/instructionPrompt.ts` (T157) — même validateur que le script, donc même définition de « forme valide » des deux côtés du pipeline. Un JSON malformé, tronqué, ou dont une clé manque est **refusé avec un message**, sans aucune écriture.

Un JSON valide affiche un **diff par section** entre l'anglais en base et l'anglais proposé, phrase par phrase. L'écriture ne part qu'après confirmation, par la mutation de T159 — ce ticket n'ouvre pas de second chemin d'écriture.

### Tests

- `buildReviewRequest` : les phrases sont numérotées et appariées, les objections référencées, les règles présentes.
- JSON malformé, tronqué, clé manquante, tableau devenu chaîne → refus, aucune mutation appelée.
- JSON valide → diff affiché, mutation appelée seulement après confirmation.
- Repli de presse-papier quand `navigator.clipboard` est absent.

## Out of Scope

- **Tout appel LLM depuis le navigateur.** Aucune clé d'API côté client, jamais. L'aller-retour passe par le presse-papier et c'est un choix, pas une limitation.
- Toute mémoire de traduction, ou réutilisation d'un arbitrage passé sur une phrase similaire.
- Un second chemin d'écriture : la mutation reste celle de T159.
- La correction du **français** source, même si l'arbitrage révèle qu'il est fautif.

## Acceptance Criteria

- [ ] La demande copiée contient les noms, les phrases numérotées et appariées, les objections, et les règles maison.
- [ ] Un JSON malformé ou incomplet est refusé avec un message, et aucune mutation n'est appelée.
- [ ] Un JSON valide affiche un diff par section avant écriture, et l'écriture n'a lieu qu'après confirmation.
- [ ] Le validateur est **le même** que celui du script de T157.
- [ ] Le repli de presse-papier fonctionne sans `navigator.clipboard`.
- [ ] `buildReviewRequest` est pure et testée sans rendu.
- [ ] **Démo** : sur une ligne `flagged`, copier la demande, coller un JSON corrigé, lire le diff, écrire — et voir l'app en anglais afficher le texte corrigé.

## References

- Epic Brief : `docs/Epic_Brief_—_English_Exercise_Instructions_#417.md`, stories 8, 9
- Tech Plan : `docs/Tech_Plan_—_English_Exercise_Instructions_#417.md`, § Component Responsibilities (`ReviewAssistDialog`)
- Issue [#417](https://github.com/PierreTsia/workout-app/issues/417)
- Précédents : `file:src/components/ErrorFallback.tsx`, `file:src/components/admin/review/ExerciseReviewToolbar.tsx`
