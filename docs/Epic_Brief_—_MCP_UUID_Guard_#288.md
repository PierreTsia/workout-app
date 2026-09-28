# Epic Brief — MCP UUID Guard (#288)

## Summary

Les agents qui consomment le MCP GymLogic peuvent, après une `search_exercises` vide, fabriquer un identifiant de repli (ex. `kroc-row-id`) et l'envoyer à `get_exercise_details` ou aux write-tools. Aujourd'hui le serveur répond par une erreur générique de catalog-miss qui n'explique pas la malformation. Cet epic rend le garde-fou structurel : toute entrée d'id non-UUID est rejetée en amont avec un message actionnable, et la règle anti-pattern est gravée dans le SKILL canonique. Bénéfice permanent pour tous les agents, sans dépendre de leur prompt.

---

## Context & Problem

**Who is affected:** tous les agents MCP (Iris, Claude Desktop, OpenClaw, Le Chat) ; indirectement l'utilisateur final via les patches programmes.

**Current state:**
- L'incident de référence : Iris (HITL Epic C #280) a inventé `kroc-row-id` après une recherche `Kroc row` vide, et l'a passé à `get_exercise_details`.
- `get_exercise_details` ne valide aucun format d'id : la requête part en base et revient en miss générique.
- `fetchExercisesByIds` (catalogue partagé des write-tools `create_program` / `update_program`) retourne `Unknown or inaccessible exercise_id(s): …` sans distinguer « id malformé » de « id valide mais absent ».
- Le SKILL canonique contient la règle générique « Never invent or transcribe from memory » mais aucun paragraphe dédié au cas « recherche vide → ne pas fabriquer de placeholder ».
- Un helper `isUuid` (check de forme UUID, tests verts) existe déjà côté edge function — l'infrastructure de validation est là, elle n'est simplement pas branchée sur ces deux chemins.

**Pain points:**
| Pain | Impact |
|---|---|
| Erreur non actionnable sur id malformé | L'agent boucle ou improvise ; trace de debug confuse pour l'humain |
| Aucune validation de format sur le chemin lecture (`get_exercise_details`) | La branche la plus exposée est la moins gardée |
| Règle SKILL implicite seulement | Chaque nouvel agent doit redécouvrir l'anti-pattern, ou pas |

---

## User Stories

1. En tant qu'agent MCP, quand je passe un id qui n'est pas un UUID à `get_exercise_details`, je veux une erreur explicite me disant de relancer `search_exercises` et de choisir un id retourné, pour ne pas boucler sur un miss incompréhensible.
2. En tant qu'agent MCP, quand je passe un id UUID bien formé mais absent du catalogue à un write-tool, je veux l'erreur catalog-miss existante, pour distinguer « mal formé » de « pas accessible ».
3. En tant qu'agent MCP, quand `search_exercises` ne retourne aucun résultat exploitable, je veux que le SKILL canonique me dise d'abandonner l'option ou de demander à l'utilisateur, jamais de fabriquer un placeholder, pour éviter l'amorce de l'incident.
4. En tant que développeur du MCP, je veux la validation de forme centralisée sur le helper `isUuid` existant, pour ne pas dupliquer la regex dans les handlers.
5. En tant qu'humain en HITL, je veux que le comportement soit couvert par des tests vitest sur les deux branches, pour que le garde-fou survive aux refactors.

### Success measures

| Story # | Measure |
|---|---|
| 1–2 | 100 % des ids non-UUID reçoivent le message actionnable (couverture test) |
| 5 | CI verte avec les nouveaux cas vitest, sans réseau ni clé |

Stories sans mesure numérique : validées qualitativement par la story elle-même.

---

## Scope

**In scope:**
1. Validation de forme UUID + message actionnable dans `get_exercise_details` (chemin lecture).
2. Distinction malformed-id vs catalog-miss dans `fetchExercisesByIds` (chemin write, partagé par `create_program` / `update_program`).
3. Cas vitest sur les deux branches (format rejeté, format valide mais absent).
4. Paragraphe anti-pattern dédié dans `skills/gymlogic-mcp/SKILL.md` (recherche vide → abandonner / demander, jamais de placeholder), avec exemple du mauvais pattern.
5. Re-validation HITL du prompt cardio Iris : recherche vide → pas d'id fabriqué, l'agent abandonne ou demande.

**Out of scope:**
- Renforcement de la regex `isUuid` vers le format v4 strict (v4 serait plus strict ; le check de forme suffit au garde-fou, décision dans le tech plan si jugé utile).
- Miroir de la règle dans le `AGENTS.md` d'Iris (chemin (3) de l'issue : au prochain refresh agent, pas ici).
- Fuzzy matching FR de `search_exercises` (#286) — la cause racine de la recherche vide est un ticket séparé.

---

## Success Criteria

- **Numeric :** aucun appel tool avec id non-UUID ne peut atteindre Postgres sans recevoir le message actionnable ; tous les nouveaux cas vitest passent en CI fixtures-only (sans réseau ni clé).
- **Qualitative :** un agent sous pression de récupération (recherche vide) ne peut plus interpréter l'erreur comme un miss de catalogue ; le SKILL canonique rend l'anti-pattern explicite pour tout agent futur.

---

## References

- Issue #288 (contrat : body + relecture critique 2026-09-28, acceptance raffinée)
- Incident : HITL Epic C #280, prompt 3 (21:56:17), PR #285
- Tech plan : à rédiger par dev-gymlogic (`docs/Tech_Plan_—_…`)
