# T188 — MCP AMRAP history

## Goal

`get_workout_history` lit un AMRAP terminé comme `27+3` glosé (`27 tours · 3 pompes`). Ligne **nouvelle**, pas un append à `sessions.active_duration_ms`. Couvre la story 25 (read score).

## Mode

**AFK** — mêmes règles que T186 ; pas d’import `src/` depuis Deno.

## Slice

`mcp/lib` score formatter (mirror T186) → `sessionHistoryGrouping` / `getWorkoutHistory` → Deno tests

## Dependencies

T186 (règles + fixtures de référence), T187 (blocks persistés avec `mode` / cap).

## Scope

- Formatter MCP (ex. `file:supabase/functions/mcp/lib/format.ts` ou voisin) : full rounds + leftover named, gloss FR/EN. Completeness = `block_runs.finished_at`.
- `file:supabase/functions/mcp/tools/getWorkoutHistory.ts` + `sessionHistoryGrouping.ts` : une ligne de score par Circuit AMRAP finished. **Ne pas** accrocher ça à `active_duration_ms`.
- Tours : grouping actuel, **pas** de CCT sur le wire (ADR 0011 deferred — on n’en profite pas pour le glisser).

## Out of Scope

- Sheet in-app → **T186**.
- Writes / dry_run → **T187**.
- Circuit Completion Time MCP pour **Tours**.

## Acceptance Criteria

- [ ] Fixture Cindy finished `27+3` : history contient le hero **et** la gloss nommée.
- [ ] `finished_at` null : pas de score PB / pas de ligne `27+3`.
- [ ] Session duration line inchangée (`active_duration_ms`).
- [ ] Fixture Tours : output history inchangé vs pre-T188.
- [ ] Tests : parity numérique avec les cas T186 (mêmes leftover / fingerprint).

## References

- Epic Brief : story 25
- Tech Plan : history MCP = ligne nouvelle ; lockstep `getWorkoutHistory`
