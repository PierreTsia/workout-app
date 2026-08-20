# T180 — Tour motion polish + reduced-motion + header offset

## Goal

Finish desktop motion: Ken Burns per-scene focals, shared `--header-h` so sticky clears the header, and a full `prefers-reduced-motion` path where all six scenes stay reachable without scroll theater. Addresses Epic story 12.

## Mode

**AFK** — behavior specified in Tech Plan.

## Slice

Header CSS var → TourSplitStage Ken Burns + reduced-motion branch → a11y QA

## Dependencies

T179.

## Scope

### Header offset

- Expose `--header-h` (measure or constant matching sticky header) used by Tour pin/`top`

### Motion

- Ken Burns on active stage layer using each scene’s `focal` (`transform-origin`)
- Crossfade timing polished; respect `motion-safe` / `prefers-reduced-motion`

### Reduced motion

- When reduce is on: no pin theater / no Ken Burns; rail click still switches stage **or** jump to mobile linear anchors — all 6 reachable

### Tests

- Helper tests for reduced-motion branch selection if extracted
- Manual checklist: OS reduce-motion on → still reach scene 06

## Out of Scope

- Gen-AI video
- Capture swap (T181)
- Visual HITL sign-off (T182)

## Acceptance Criteria

- [ ] Sticky stage clears header (no overlap) using `--header-h`
- [ ] Active scene runs subtle Ken Burns from banked `focal` when motion allowed
- [ ] `prefers-reduced-motion: reduce` disables theater; all 6 scenes still reachable
- [ ] No empty void regression from T179
- [ ] `web` build passes

## References

- Tech Plan Failure Mode Analysis + Kick-ass scroll sketch
- Epic story 12
