# T187 — MCP AMRAP write + echo

## Goal

Un agent persiste Cindy via `create_program` / `create_workout_day` / `update_program` : `{ type: "circuit", mode: "amrap", cap_minutes, exercises: [{ exercise_id, amount, weight_kg }] }`. `mode` omis = **Tours**. AMRAP + `rounds` / `per_round` / rest / transition → **reject** (pas de drop silencieux). dry_run / details parlent `AMRAP 20 min` + gloss. Couvre les stories 24–25 (writes + echo ; history score → T188).

## Mode

**AFK** — wire ADR 0011 additif. HITL « crée-moi Cindy » → **T190**.

## Slice

`circuitItemSchema` + `parseCircuitInput` → edge `blockPersistence` → dry_run `format` + details echo → `createWorkoutDay` oneOf fix → Deno tests + skill

## Dependencies

T183 (`exercise_blocks.mode` / `cap_seconds`).

## Scope

### Parse — `file:supabase/functions/mcp/lib/createProgramValidation.ts` + `file:supabase/functions/mcp/lib/circuitItemSchema.ts`

- Parser **explicitement** `mode` / `cap_minutes` (aujourd’hui les unknown keys droppent).
- `mode?: "rounds" | "amrap"` ; omis = `"rounds"`. Unknown mode → reject.
- AMRAP : `cap_minutes` 1–60 (défaut 20 si omis **uniquement** quand `mode=amrap` sans cap — ou require cap ; rester cohérent : défaut 20). Persist `cap_seconds = minutes * 60`.
- Reject si `mode=amrap` **et** présence de `rounds` / `rest_seconds` / `transition_seconds` / nested `per_round`.
- Tours : chemin actuel ; reject `cap_minutes` sur Tours.

### Persist / echo

- Edge `file:supabase/functions/mcp/lib/blockPersistence.ts` : AMRAP `rounds=1`, rest/transition 0, `per_round` length 1.
- `dbBlockToCircuitWire` / `dbBlockToParsedCircuit` echo `mode` + `cap_minutes`.
- `formatCircuitPreviewLines` : Tours header inchangé ; AMRAP → `AMRAP 20 min` + gloss, **jamais** le sigle nu (`file:supabase/functions/mcp/lib/format.ts`, `daySequence.ts` / `daySequenceRead.ts`).

### Tools

- `createProgram` / `updateProgram` / **`createWorkoutDay`** : `oneOf` Circuit dans l’inputSchema (**fix** : `create_workout_day` omet encore le bras Circuit).
- Skill GymLogic : note CrossFit + wire example Cindy ; omis = Tours.

## Out of Scope

- `get_workout_history` `27+3` → **T188**.
- Groq/Gemini / preview UI → **T189**.
- Nouvel outil MCP. Pas de `circuits[]`.

## Acceptance Criteria

- [ ] Payload Cindy (flat nested, `mode: "amrap"`, `cap_minutes: 20`) persist + details echo `AMRAP 20 min`.
- [ ] Omis `mode` : Tours, defaults 3/90/0, header `N rounds` inchangé.
- [ ] `mode: "amrap"` + `rounds: 3` (ou `per_round`, ou rest) → reject, rien d’écrit.
- [ ] `create_workout_day` inputSchema expose le `oneOf` Circuit (AMRAP inclus).
- [ ] dry_run `rendered` : 0 occurrence de `AMRAP` sans minutes + gloss.
- [ ] Tests Deno/vitest parse/reject/echo ; Zeus wire fixtures non-régression.

## References

- Epic Brief : stories 24–25
- Tech Plan : MCP lockstep files ; unknown keys ; `create_workout_day` oneOf
- ADR 0011 + 0014
