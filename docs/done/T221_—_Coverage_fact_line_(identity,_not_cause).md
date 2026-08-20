# T221 — Coverage fact line (identity, not cause)

## Goal

On **Dernière séance**, when logged catalog identities differ from the live **Unified Day Sequence**, show a fact line (`1 Circuit loggé · 4 au programme`). No line when they match, when logs include a jetable **Circuit**, or when the live day has a jetable **Circuit** that makes comparison dishonest. Stories 8–10.

## Mode

AFK

## Slice

`sessionCoverage` lib → `CoverageFactLine` in `LastSessionRecap` → vitest

## Dependencies

T220 (`LastSessionRecap` header exists)

## Scope

### Pure helper — `file:src/lib/sessionCoverage.ts`

Inputs: grouped history items + `blockRuns` map + live `DayItem[]`.

| Result | When |
|---|---|
| `{ comparable: false }` | Any logged block lacks a catalog id (`sheetCatalogId` null) **or** any live block has `benchmark_circuit_id == null` |
| `{ comparable: true, equal: true }` | Circuit catalog set and solo `exercise_id` set both equal |
| `{ comparable: true, equal: false, loggedItems, programItems }` | Counts of sequence items (circuits + solos) on each side |

`loggedItems` / `programItems` = number of **sequence items**, not stations (Theseus = 1, not 3).

Tests: Theseus-only logs vs 4 seeded blocks → not equal, 1 vs 4; same four slugs → equal; one jetable live block → not comparable; wipe-shaped solos-only logs vs 4 circuits → comparable mismatch (1+ solos vs 4 circuits) **unless** you treat unknown grouping as not comparable — **prefer comparable mismatch** so the filet still fires on the #498 shape after flatten. If logs are all solos and the day is all circuits, that is a mismatch, not jetable.

Jetable means `benchmark_circuit_id` null on a **block** group, not “solos exist”.

### UI

In `LastSessionRecap` last-session panel, under the date/duration, if `comparable && !equal`, render muted fact line via `recap.coverage` with `logged` / `program` counts.

No « jour a changé ». No fact line if `!comparable` or `equal`.

### i18n

FR: `{{logged}} Circuit(s) loggé(s) · {{program}} au programme` is wrong when mixed solos. Use item-neutral copy:

| Key | EN | FR |
|---|---|---|
| `recap.coverage` | {{logged}} logged · {{program}} in the program | {{logged}} loggé(s) · {{program}} au programme |

Keep it dumb and countable. Do not mention Circuit in the string if mixed days exist — the lists below already show kinds.

## Out of Scope

- Persisting a day snapshot
- CASCADE / wipe repair
- Changing grouping (T220)

## Acceptance Criteria

- [ ] Unit: 1 catalog Circuit logged vs 4 live catalog Circuits → `equal: false`, counts 1 and 4
- [ ] Unit: identical catalog sets → no fact line (`equal: true`)
- [ ] Unit: jetable logged Circuit → `comparable: false`
- [ ] Recap test: mismatch renders the coverage string; match does not
- [ ] Copy never includes “changé” / “changed”

## References

- Epic Brief stories 8–10
- Tech Plan `sessionCoverage`
- `file:src/lib/sessionHistoryGrouping.ts` `sheetCatalogId`
