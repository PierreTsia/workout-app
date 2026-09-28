# T251 — fetchExercisesByIds two-tier + cas vitest

## Goal

`fetchExercisesByIds` distingue « id malformé » (non-UUID) de « id UUID valide mais absent du catalogue » : les ids malformés sont rejetés en amont avec un message actionnable, sans requête Postgres. C'est la moitié write du garde-fou #288 (défense-en-profondeur : les 3 callers actuels pré-filtrent déjà).

## Dependencies

- Tech Plan `file:docs/Tech_Plan_—_MCP_UUID_Guard_#288.md`
- Helper `isUuid` (`file:supabase/functions/mcp/lib/uuid.ts`) — déjà mergé.

## Scope

### Two-tier dans fetchExercisesByIds

| Item | Detail |
|---|---|
| Check amont | Avant la requête `IN (...)` : si un id échoue à `isUuid`, retour immédiat `{ data: [], error: … }`, zéro `.in()` émis |
| Message malformed | `"<id>" is not a valid UUID. Do not invent ids — re-run search_exercises (or resolve_exercises by name) and pick a returned id.` (ids malformés listés) |
| Message valid-miss | `Unknown or inaccessible exercise_id(s): …` — **inchangé** |

```ts
const malformed = unique.filter((id) => !isUuid(id))
if (malformed.length > 0) {
  return {
    data: [],
    error: `"${malformed.join('", "')}" is not a valid UUID. Do not invent ids — re-run search_exercises (or resolve_exercises by name) and pick a returned id.`,
  }
}
```

### Tests (vitest, fake supabase existant)

- Id malformé seul (`kroc-row-id`) → message actionnable, **aucun appel `.in()`** (assert sur `_calls`).
- Liste mixte (1 malformé + 1 valide) → rejet immédiat, aucun fetch.
- Valid-miss existant → message générique inchangé (non-régression).
- Empty list → comportement court-circuit actuel inchangé.

## Out of Scope

- Changement des validateurs amont (`createProgramValidation.ts`, `exerciseConversion.ts`).
- Le chemin read (`getExerciseDetails.ts`) — T252.
- SKILL.md — T253.

## Acceptance Criteria

- [ ] Id non-UUID → message `is not a valid UUID` sans requête Postgres (test assert `_calls` vide)
- [ ] Id UUID valide mais absent → message miss générique inchangé
- [ ] Flux nominaux des 3 write-tools inchangés (`Invalid UUID at days[...]` reste émis par le validateur, pas par le lookup)
- [ ] `npx vitest run` vert sur les fichiers MCP touchés

## References

- Issue #288, Epic Brief #288, Tech Plan #288
