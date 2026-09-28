# T252 — getExerciseDetails : isUuid partagé + tests de non-régression

## Goal

Le chemin read du garde-fou #288 (validé dans #543) utilise le helper partagé `isUuid` au lieu d'une regex locale dupliquée, et son comportement est figé par des tests handler : le garde-fou mergé ne peut plus régresser silencieusement.

## Dependencies

- Tech Plan `file:docs/Tech_Plan_—_MCP_UUID_Guard_#288.md`
- Helper `isUuid` (`file:supabase/functions/mcp/lib/uuid.ts`).

## Scope

### Refactor

| Item | Detail |
|---|---|
| Import | `import { isUuid } from "../lib/uuid.ts"` dans `file:supabase/functions/mcp/tools/getExerciseDetails.ts` |
| Suppression | Du `UUID_RE` local (ligne 76) et du check `UUID_RE.test` |
| Comportement | **Inchangé** — même regex de forme, mêmes messages, même ordre des branches |

### Nouveau fichier de tests handler

`supabase/functions/mcp/tools/getExerciseDetails_test.ts` — style Deno black-box de `createWorkoutDay_test.ts` (imports `https://deno.land/std@0.224.0/assert`, handler via registry, fake supabase `from("exercises").select("*").eq("id", …).single()`).

| Cas | Assertion |
|---|---|
| `exercise_id` absent | `exercise_id is required. Use resolve_exercises…` |
| `exercise_id: "kroc-row-id"` | Message figé verbatim : `` Invalid exercise_id format: "kroc-row-id". Expected a UUID — use `resolve_exercises` (by name) or `search_exercises` (browse) to find it. `` + `isError` |
| UUID valide mais absent | `Exercise not found (id: …). Try resolve_exercises…` |
| Happy path (fixture row) | Markdown formaté attendu (name, muscle group, equipment) |

## Out of Scope

- Toute modification de wording du message read-path.
- Two-tier côté write — T251.
- SKILL.md — T253.

## Acceptance Criteria

- [ ] Aucune regex UUID locale dans `getExerciseDetails.ts` (une seule définition : `lib/uuid.ts`)
- [ ] Les 4 cas handler passent, dont le message malformed figé verbatim
- [ ] Tests MCP existants verts (`createWorkoutDay_test.ts`, `updateProgram_test.ts`, `registry_test.ts`)
- [ ] CI verte sans réseau ni clé (fixtures-only)

## References

- Issue #288, Epic Brief #288, Tech Plan #288, PR #543 (garde-fou initial)
