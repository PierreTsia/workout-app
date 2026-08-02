# T157 — Translation pipeline & quality gate

## Goal

Livrer le pipeline qui traduit les consignes françaises en anglais, les fait contre-relire par un **second modèle d'un autre fournisseur**, et écrit contenu, statut et audit en une seule opération par ligne. Le script est idempotent par construction et s'exécute par vagues, pour que le rayon d'explosion reste choisi.

Le filet qualité est promu depuis les fichiers de spike vers `src/lib/`, où le type-check et Vitest le couvrent — parce que **CI ne type-check pas `scripts/`**, et que le seul code du pipeline qui doive être juste ne peut pas vivre dans l'angle mort.

Couvre les stories 11, 12, 13, 14 et 15 de l'Epic Brief.

## Mode

**AFK** — le modèle, le contre-relecteur, le vocabulaire de statut et l'ordre des vagues sont tranchés dans le Tech Plan. Rien ne reste à décider en vol.

## Slice

`src/lib/instructionQuality.ts` + `instructionPrompt.ts` → CLI `scripts/translate-instructions.ts` → Gemini → Groq → écriture des 4 colonnes → vitest

## Dependencies

T156 (les colonnes et le vocabulaire de statut).

## Scope

### Promotion du filet dans `src/lib`

`file:scripts/spike-checks.ts` devient `src/lib/instructionQuality.ts`, en fonctions **pures** sur une paire (source française, traduction anglaise), sans I/O. Contrôles portés : parité de longueur, nombres perdus, matériel inventé, muscle non traduit, bavure de casse, résidus français, glossaire au niveau de la phrase, mode impératif sous « common mistakes », calques anatomiques, ratio de deuxième personne.

Deux corrections obligatoires, chacune adossée à un test nommé :

| Faux positif mesuré au spike | Correction |
|---|---|
| « pupitre Larry Scott » signalé comme matériel inventé alors que *preacher bench* est la traduction juste | Synonymes de matériel reconnus |
| « Lower back to 90° » signalé par la **bavure de casse** : *Lower back* est le libellé anglais des lombaires, et le filet analysait le bloc entier concaténé, si bien que toute phrase sauf la première perdait l'exemption d'ouverture de phrase | Bavure de casse évaluée phrase par phrase |

Les frontières de mots utilisent des lookarounds Unicode, **pas `\b`**, qui échoue sur `élastique` et `épaules`.

`src/lib/instructionPrompt.ts` porte `buildPrompt()`, `parseInstructions()` et `PROMPT_VERSION`. La dérivation du statut est elle aussi une fonction pure et testée : `deriveStatus(gateFlags, objections, checkerAvailable)`.

### CLI

`scripts/translate-instructions.ts`, env via `file:scripts/load-env.ts`, service role via le patron de `file:scripts/enrichment-config.ts`. Entrée dans `package.json` sur le modèle des autres scripts d'enrichissement.

| Drapeau | Effet |
|---|---|
| *(défaut)* | **Dry-run** — traduit, contrôle, affiche, n'écrit rien |
| `--apply` | Écrit en base |
| `--unlogged` | Vague longue traîne : les exercices sans aucune série loguée |
| `--top N` | Les N exercices les plus logués |
| `--ids a,b,c` | Liste explicite |
| `--force` | Réécrit une ligne déjà traduite, **sauf `approved`** |

Dry-run par défaut suit `file:scripts/backfill-was-pr.ts` ; `file:scripts/enrich-instructions.ts` écrit sans garde-fou et sert de contre-exemple.

### Traduction et contre-relecture

Gemini 2.5 Flash traduit — mesuré sur un échantillon aléatoire de 30 lignes tiré à la graine : 29/30 propres, zéro inversion de mode sur 107 entrées d'erreurs courantes, 98 % de cohérence en deuxième personne.

Groq `llama-3.3-70b-versatile` contre-relit **paire de phrases par paire de phrases**, et rend un verdict d'équivalence sémantique. Le fournisseur est différent du traducteur exprès : c'est ce qui rend les erreurs non corrélées, et c'est la seule façon d'attraper le défaut réel du spike — « largeur des épaules » rendu *hip-width*, qu'aucune regex ne peut voir.

Séquentiel, une ligne à la fois, avec respect de `Retry-After` — le patron des spikes, pas celui de `enrich-instructions.ts` qui ignore les 429.

### Écriture

Sélection : `instructions IS NOT NULL AND instructions_en IS NULL`, filtrée par la vague. Les quatre colonnes partent en **une seule mise à jour** : contenu, statut dérivé, audit. Jamais d'écriture partielle, jamais un bloc dont la forme n'a pas été validée avant.

Statut dérivé : filet propre **et** aucune objection du contre-relecteur → `clean`. Sinon `flagged`. Contre-relecteur indisponible ou quota épuisé → `flagged`, **jamais** `clean` : un quota mort ne doit pas produire de l'anglais réputé propre.

### Nettoyage

Les cinq fichiers de spike non commités disparaissent dans ce ticket, leur logique étant promue : `spike-checks.ts`, `spike-translate-instructions.ts`, `spike-deepl-instructions.ts`, `spike-gemini-instructions.ts`, `spike-model-comparison.ts`.

### Tests

- `instructionQuality` : les deux régressions nommées, plus un cas par contrôle.
- `deriveStatus` : filet propre sans objection, filet propre avec objection, filet sale, contre-relecteur absent.
- `parseInstructions` : JSON valide, JSON entouré de prose, JSON invalide, forme incomplète.

## Out of Scope

- Toute UI : c'est T158 à T160.
- L'exécution sur le catalogue réel : c'est T161. Ce ticket se démontre sur trois lignes.
- Toute correction du **français** source, même quand la contre-relecture révèle qu'il est fautif. Signalé dans l'audit, jamais corrigé.
- Un `tsconfig.scripts.json` pour type-checker les 45 scripts du repo. Trou systémique réel, rayon d'explosion inconnu, chantier séparé.

## Acceptance Criteria

- [ ] « pupitre Larry Scott » et « Lower back to 90° » ne déclenchent plus d'alerte, chacun couvert par un test nommé.
- [ ] Les frontières de mots survivent aux accents (`élastique`, `épaules`) — test dédié.
- [ ] Contre-relecteur indisponible → statut `flagged`, jamais `clean`.
- [ ] Sans `--apply`, aucune écriture en base, vérifié sur une exécution complète.
- [ ] Deux exécutions consécutives avec `--apply` : **zéro écriture** sur la seconde.
- [ ] `--force` laisse intactes les lignes `approved`.
- [ ] Une ligne dont le JSON du modèle est invalide est sautée, ses colonnes restent nulles, et l'exécution suivante la reprend.
- [ ] Les cinq fichiers de spike ne sont plus dans l'arbre.
- [ ] **Démo** : `--ids` sur trois exercices avec `--apply`, puis l'app en anglais affiche les trois consignes traduites — et celles passées en `flagged` restent françaises.

## References

- Epic Brief : `docs/Epic_Brief_—_English_Exercise_Instructions_#417.md`, stories 11, 12, 13, 14, 15
- Tech Plan : `docs/Tech_Plan_—_English_Exercise_Instructions_#417.md`, § Key Decisions (traducteur, contre-relecteur, verdict par défaut), § Failure Mode Analysis
- Issue [#417](https://github.com/PierreTsia/workout-app/issues/417)
- Précédents : `file:scripts/enrich-instructions.ts`, `file:scripts/backfill-was-pr.ts`, `file:scripts/load-env.ts`, `file:scripts/enrichment-config.ts`
