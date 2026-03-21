# T42 — Prompt Engineering & Multi-Day Validation

## Goal

Implement the system prompt for multi-day program design and the per-day + cross-day validation layer. After this ticket, the `generate-program` edge function produces validated, coherent multi-day programs — the backend is feature-complete.

## Dependencies

T41 (edge function scaffolding must be in place).

## Scope

### Prompt construction

`supabase/functions/generate-program/prompt.ts`:

Build the system prompt from user constraints, profile, history, and catalog. Key sections:

| Section | Content |
|---|---|
| Role | "You are a strength and conditioning coach designing a multi-day training program." |
| Rules | Day count, exercise count bounds (VOLUME_MAP[duration] +/- 2, clamped [4, 13]), IDs only from catalog, no cross-day duplicates, compound first, synergistic grouping, muscle distribution, difficulty_level matching |
| Split preference | Conditional: "The user prefers a {splitPreference} split." |
| Focus areas | Conditional: "The user wants to emphasize: {focusAreas}." |
| Training gap | Conditional: "The user hasn't trained in over 2 weeks. Propose a conservative re-entry program." |
| User profile | Experience, goal, equipment, session duration |
| Recent exercises | Conditional: exercise IDs + names from history |
| Catalog | Compact JSON: `{ id, n, mg, eq, sm, dl }` |

Catalog serialization reuses the compact format from `file:supabase/functions/generate-workout/prompt.ts`.

### Multi-day validation

`supabase/functions/generate-program/validate.ts` — `validateProgram()`:

1. Verify `days.length === targetDayCount`. Trim excess; zero days = catastrophic failure.
2. Build catalog lookup: `Map<string, CatalogEntry>`.
3. `globalSeen` set for cross-day dedup.
4. Per day:
   - Filter IDs: keep only those in catalog.
   - Remove cross-day duplicates (already in `globalSeen`).
   - Add valid IDs to `globalSeen`.
   - If count < min: backfill from catalog scoped to day's `muscle_focus`, excluding `globalSeen`.
   - If count > max: trim.
5. Return `ValidateProgramResult` with per-day stats.

### Edge function integration

Wire `prompt.ts` and `validate.ts` into `index.ts`:
- Replace placeholder prompt with real prompt builder
- Add validation pass after Gemini response
- Add single retry on catastrophic failure (zero valid days or unparseable response)
- Return validated `{ rationale, days }` or `{ error }`

## Out of Scope

- Frontend integration (T43)
- UI components (T45—T46)
- Prompt A/B testing or versioning

## Acceptance Criteria

- [ ] Prompt includes all conditional sections when applicable (split preference, focus areas, training gap, recent exercises)
- [ ] Prompt omits conditional sections when data is absent
- [ ] Catalog is serialized in compact format, capped at 120 exercises
- [ ] Validation drops hallucinated IDs and backfills from the correct muscle group
- [ ] Cross-day duplicate exercises are removed
- [ ] Exercise count per day is enforced within VOLUME_MAP bounds
- [ ] Catastrophic failure (zero valid days) triggers exactly one retry
- [ ] Full round-trip (prompt + Gemini + validation) returns a valid program JSON via curl

## References

- Epic Brief: `file:docs/Epic_Brief_—_AI-Powered_Program_Generation.md` (Scope items 5, 6, 9)
- Tech Plan: `file:docs/Tech_Plan_—_AI-Powered_Program_Generation.md` (Prompt Construction, Multi-Day Validation sections)
- Existing validation: `file:supabase/functions/generate-workout/validate.ts`
