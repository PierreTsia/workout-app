# T222 — HITL: Home done-day eyeball on #498 repro

## Goal

Human confirms the #498 phone case on a real (or seeded) account: Home 2 done in cycle, **Dernière séance** shows Theseus as an **AMRAP** score, **Programme** shows four Circuits, hero says `4 Circuits`, no `5 × 0–10`. Stories 1, 4, 6, 7, 12.

## Mode

HITL — needs the production (or staging) programme **6d Program — Salle & Home** and Pierre’s eyes. Agents cannot sign off the Stitch-shaped layout.

## Slice

manual Home → tabs → hero → footer (no code unless a miss from T219–T221)

## Dependencies

T219, T220, T221

## Scope

On device / hosted preview, with the cycle in the state from the 2026-08-20 screenshots (or equivalent: day done, last session a single **Benchmark Circuit**, live day has four):

1. Hero: checkmark, body map, **4 Circuits** (or mixed badge if the day also has solos). No 11 min, no 12 séries, no 12 exercices.
2. Tabs: **Dernière séance** selected. Theseus (or the logged Circuit) is a Circuit card + score, not linear `5 × 0–10`.
3. Fact line present if 1 vs 4 identities.
4. **Programme**: four WOD cards, no kg, no pencil/trash.
5. Footer: already-done + restart cycle. No Start.
6. Swipe to an **undone** day: tabs gone, Start back.
7. EN locale: Last session / Program.

If something fails, file a follow-up on #498 — do not reopen wipe/CASCADE.

## Out of Scope

- Pixel-perfect vs Stitch as a merge gate (eyeball only)
- MCP `update_program` persistence

## Acceptance Criteria

- [x] Pierre replies that the seven checks pass, or lists misses
- [x] No new flatten regression on the repro day

## References

- Epic Brief success criteria
- Stitch prompt in the #498 grilling thread (tabs variant)
