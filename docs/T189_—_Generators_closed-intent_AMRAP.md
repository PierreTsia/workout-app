# T189 — Generators closed-intent AMRAP

## Goal

Quick Workout (Groq + Gemini) et le draft **Embedded Agent** *peuvent* émettre `mode: "amrap"` + `cap_minutes`, mais **seulement** sur une liste d’intent fermée. Ambigu → **Tours**. Preview parle `AMRAP 20 min`. Couvre la story 26.

## Mode

**AFK** — fixtures string/schema, **pas** d’appels LLM live.

## Slice

`programDraftSchema` + QW `groq.ts`/`gemini.ts`/`validate.ts` → `PreviewCircuitCard` / `draftPreviewItems` → fixtures intent

## Dependencies

T187 (wire MCP canonique : un générateur qui émet AMRAP doit passer `parseCircuitInput`).

## Scope

### Schema lockstep

- `file:supabase/functions/_shared/programDraftSchema.ts` + `programDraft.ts` (`validateProgram`) : `mode` / `cap_minutes` optionnels, mêmes bounds que MCP.
- `file:supabase/functions/generate-quick-workout/groq.ts`, `gemini.ts`, `validate.ts`.
- Parity test Gemini/Groq étendu (T168) : les deux exposent les champs.

### Intent list **fermée** → AMRAP

Le mot AMRAP ; « autant de tours » ; Cindy ; Holland ; un cap **sans** nombre de tours.

### Intent → Tours (défaut)

« HIIT 20 min » ; « 4 rounds in 20 min » ; tout le reste d’aujourd’hui.

Prompts : heuristiques **fixture-assert** (sous-chaînes), pas de live call.

### Preview

- `file:src/lib/draftPreviewItems.ts`, `file:src/types/generator.ts`, `file:src/components/generator/PreviewCircuitCard.tsx` : `AmrapLabel` (T183) si AMRAP.
- Hydration client : ne pas forcer `rounds ?? 3` sur un item `mode=amrap`.

## Out of Scope

- Catalogue nommé **#398**.
- Forcer AMRAP sur du conditionnement générique.
- MCP persist (déjà T187) ; Round Screen.

## Acceptance Criteria

- [ ] Fixture « Cindy / Holland / AMRAP 20 / autant de tours » → `mode: "amrap"`, `cap_minutes: 20`, nested flat, **pas** de `rounds`.
- [ ] Fixture « HIIT 20 min » et « 4 rounds in 20 min » → `mode` omis/`rounds`, pas amrap.
- [ ] Payload généré AMRAP passe la validation MCP T187 (reject si rest/per_round fuit).
- [ ] Preview : `AMRAP 20 min` + gloss, 0 sigle nu.
- [ ] Gemini et Groq schemas restent en lockstep (parity test).
- [ ] Tests : fixtures ci-dessus + `validateProgram` / QW `validate.ts`.

## References

- Epic Brief : story 26 + success measure fixtures
- Tech Plan : générateurs ; closed intent ; PreviewCircuitCard
