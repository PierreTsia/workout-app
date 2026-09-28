# Epic Brief — MCP UUID Guard (#288)

## Summary

Les agents qui consomment le MCP GymLogic peuvent, après une `search_exercises` vide, fabriquer un identifiant de repli (ex. `kroc-row-id`) et l'envoyer à un tool. Le garde-fou est **à moitié mergé** : le chemin lecture (`get_exercise_details`) valide déjà le format UUID avec un message actionnable (PR #543), mais avec une regex locale dupliquée et sans test ; le chemin write (`fetchExercisesByIds`, partagé par `create_program` / `update_program`) répond toujours par une erreur générique qui ne distingue pas « id malformé » de « id valide mais absent ». Cet epic ferme le gap restant : two-tier sur la branche write, refactor sur le helper partagé `isUuid`, tests sur les deux branches, et règle anti-pattern gravée dans le SKILL canonique. Bénéfice permanent pour tous les agents, sans dépendre de leur prompt.

---

## Context & Problem

**Who is affected:** tous les agents MCP (Iris, Claude Desktop, OpenClaw, Le Chat) ; indirectement l'utilisateur final via les patches programmes.

**Current state:**
- L'incident de référence : Iris (HITL Epic C #280) a inventé `kroc-row-id` après une recherche `Kroc row` vide, et l'a passé à `get_exercise_details`.
- Chemin lecture : `get_exercise_details` **valide déjà le format** (retourne `Invalid exercise_id format: "<id>". Expected a UUID — use resolve_exercises…`) — mais via un `UUID_RE` local dupliqué (ligne 76) au lieu du helper `isUuid` (`lib/uuid.ts`), et **aucun test** ne couvre cette branche d'erreur (une seule occurrence du message, dans le code).
- Chemin write : `fetchExercisesByIds` retourne `Unknown or inaccessible exercise_id(s): …` sans distinguer « id malformé » de « id valide mais absent » — la moitié du garde-fou reste à construire.
- Le SKILL canonique contient la règle générique « Never invent or transcribe from memory » mais aucun paragraphe dédié au cas « recherche vide → ne pas fabriquer de placeholder ».

**Pain points:**
| Pain | Impact |
|---|---|
| Erreur non actionnable sur id malformé (branche write) | L'agent boucle ou improvise ; trace de debug confuse pour l'humain |
| Regex dupliquée entre `get_exercise_details` et `lib/uuid.ts` | Divergence de contrat possible entre les deux chemins |
| Branche read non testée | Le garde-fou mergé peut régresser silencieusement |
| Règle SKILL implicite seulement | Chaque nouvel agent doit redécouvrir l'anti-pattern, ou pas |

---

## User Stories

1. As an MCP agent, I want `fetchExercisesByIds` to tell malformed UUIDs apart from valid-but-missing ids, so that I don't retry a fabrication the server can't explain.
2. As an MCP agent, when I pass a well-formed UUID that is absent from the catalog to a write-tool, I want the existing catalog-miss error preserved, so that « malformed » and « not accessible » stay distinguishable.
3. As an MCP agent, when `search_exercises` returns no usable result, I want the canonical SKILL to tell me to abandon the option or ask the user — never fabricate a placeholder id, so that the original incident can't be re-triggered.
4. As an MCP developer, I want both id-validation sites to use the shared `isUuid` helper, so that the UUID contract is defined in exactly one place.
5. As an MCP developer, I want vitest cases covering the malformed-id branch on both the read and write paths, so that the guard survives refactors.

### Success measures

| Story # | Measure |
|---|---|
| 1 | 100 % des ids non-UUID passés aux write-tools reçoivent le message actionnable (couverture test, branche `fetchExercisesByIds`) |
| 5 | CI verte avec les nouveaux cas vitest, sans réseau ni clé |

Stories sans mesure numérique : validées qualitativement par la story elle-même.

---

## Scope

**In scope:**
1. `fetchExercisesByIds` : two-tier — id non-UUID → message actionnable (« not a valid UUID — re-run search_exercises… ») ; id UUID valide mais absent → message catalog-miss existant.
2. Refactor : remplacer le `UUID_RE` local de `get_exercise_details` par le helper `isUuid` partagé (comportement inchangé).
3. Cas vitest : branche malformed-id côté write (nouvelle) et côté read (`Invalid exercise_id format`, actuellement non couverte).
4. Paragraphe anti-pattern dédié dans `skills/gymlogic-mcp/SKILL.md` (recherche vide → abandonner / demander, jamais de placeholder), avec exemple du mauvais pattern.
5. Re-validation HITL du prompt cardio Iris : recherche vide → pas d'id fabriqué, l'agent abandonne ou demande.

**Out of scope:**
- Toute nouvelle validation côté read : déjà mergée (#543) — seule la duplication de regex et l'absence de test sont traitées ici.
- Renforcement de la regex `isUuid` vers le format v4 strict (check de forme suffisant au garde-fou ; à trancher au tech plan si jugé utile).
- Miroir de la règle dans le `AGENTS.md` d'Iris (chemin (3) de l'issue : au prochain refresh agent).
- Fuzzy matching FR de `search_exercises` (#286) — la cause racine de la recherche vide est un ticket séparé.

---

## Success Criteria

- **Numeric :** la branche write rejette 100 % des ids non-UUID avec le message actionnable, couverte par vitest (fixtures-only, sans réseau ni clé) ; la branche read existante est couverte par un test de non-régression.
- **Qualitative :** un agent sous pression de récupération (recherche vide) reçoit côté write la même guidance explicite que côté read ; le SKILL canonique rend l'anti-pattern explicite pour tout agent futur.

---

## References

- Issue #288 (contrat : body + relecture critique corrigée 2026-09-28)
- Incident : HITL Epic C #280, prompt 3 (21:56:17), PR #285 ; garde-fou read mergé dans PR #543
- Tech plan : à rédiger par dev-gymlogic (`docs/Tech_Plan_—_…`)
