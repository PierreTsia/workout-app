# T168 — Program draft Circuit emission

## Goal

Le **Program draft step** peut émettre des **MCP Circuit Items** vers `create_program` dry_run ; prompts onboarding conservateur / additional proactif. Stories Epic 13–14, 16–18 (backend).

## Mode

**AFK**

## Slice

Gemini/Groq schema → `validateProgram` → `draft.ts` map → chat/draft prompts → Deno tests

## Dependencies

T163.

## Scope

- Extend `programGemini` / `programGroq` response schemas for mixed day items (parity tests).
- `validateProgram` : circuit-aware repair ; no global uniqueness inside a Circuit ; slot counting.
- `DraftArgs` map to MCP `exercises[]` (not `string[]` only).
- `buildProgramPrompt` + `prompt/onboarding.ts` + `prompt/additional-program.ts` per ADR 0011 heuristics.
- AC on prompts = **fixture/string asserts**, not live LLM calls.

## Out of Scope

- Preview UI (T169) ; Quick Workout (T170).

## Acceptance Criteria

- [ ] Draft mapping emits valid Circuit objects that pass MCP validation (unit/integration with mocked MCP or shared validator).
- [ ] `validateProgram` keeps duplicate `exercise_id` inside one Circuit.
- [ ] Onboarding system/draft prompt text encodes conservative Circuit rules (fixture assert).
- [ ] Additional-program prompt text encodes proactive pattern heuristics (fixture assert).
- [ ] Gemini and Groq schemas stay in lockstep (parity test).

## References

- Epic : `file:docs/Epic_Brief_—_MCP_&_AI_Circuits.md`
- Tech Plan : `file:docs/Tech_Plan_—_MCP_&_AI_Circuits.md` (§ Program draft)
