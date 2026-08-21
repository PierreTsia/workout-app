# T232 — Regulars (always 100d)

## Goal

Wire **Récurrents**: rank by distinct sessions per catalog `exercise_id` over **100d always** (ignore the page toggle), tie-break `max(logged_at)`, ≥2 sessions to appear, top ~8, Circuit stations count, Program annotates only. Addresses Epic story 15.

## Mode

AFK — 100d lock and annotation-only Program are glossary-locked.

## Slice

`lib/profile/regulars` on the 200d snapshot (slice last 100d) → Regulars block → vitest (≥2 floor, Circuit stations, toggle ignored)

## Dependencies

T227 (200d snapshot covers 100d). T225 shell.

## Scope

### Algo

- Distinct `session_id` per `exercise_id` in last 100 local days
- Ignore `ProfileWindow.kind` for the ranking window
- Tie-break `max(logged_at)`
- ≥2 distinct sessions to appear (once is not a habit)
- Top ~8
- Circuit station logs count
- Active Program: badge `Sur le programme` / `Hors plan` only — do not filter the list
- Rank is session count, not set count or Tonnage

The 200d prefetch already contains 100d. Do not add a dedicated Regulars RPC.

### UI

Replace Regulars fixture adapter. Empty: no rows (not a fake top-8).

### Tests

- Toggle 7j vs 30j does not change Regulars order
- One-session exercise absent; two-session present
- Cindy pull-ups can rank
- Program annotation does not drop Hors-plan lifts

## Out of Scope

- Changing snapshot range (stay 200d)
- All-time Regulars (explicitly not a thing)

## Acceptance Criteria

- [ ] Regulars window is 100d regardless of toggle
- [ ] Exercises with a single session in 100d do not appear
- [ ] Circuit stations contribute to the distinct-session count
- [ ] Program only annotates rows
- [ ] Demoable: switch 7j → 1 an; Récurrents list is stable
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief story 15
- Tech Plan: Récurrents always 100d, prefetch 200d
- Glossary: **Regulars**
