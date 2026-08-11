# T181 — Prime Mover captures + asset swap

## Goal

Replace Tour placeholders with real EN dark-mode UI captures from the **Prime Mover** demo account (kg), one distinct shot per scene per the Tech Plan table. Addresses Epic stories 5 (visual truth), 13.

## Mode

**HITL** — requires human (or operator) access to seed/capture the demo account and approve shot framing.

## Slice

Capture checklist → screenshot files → `tourScenes` imports → rebuild `/tour`

## Dependencies

T178 (placeholders exist to replace). Can parallel T179/T180.

## Scope

### Account

- Dedicated **Prime Mover** EN locale, dark mode, kg
- Invented-but-plausible intermediate ~3×/week strength seed (echo persona)

### Shots

| Scene | Device | Content |
|---|---|---|
| 01 | Phone | Program draft preview |
| 02 | Phone | Sets table mid-set (RIR + last performance) |
| 03 | Phone | Progression suggestion |
| 04 | Phone | Quick Workout preview + rationale |
| 05 | Desktop | External agent → program in GymLogic |
| 06 | Phone | Exercise detail instructions + video |
| 07 | Phone | History heatmap primary |

### Swap

- Replace files under `web/src/assets/screenshots/tour/` (or update imports)
- Light post OK (crop/grade) — no fake AI UI chrome

## Out of Scope

- FR captures
- Gen-AI video animation
- Changing banked copy

## Acceptance Criteria

- [ ] All seven scenes use real product UI (not placeholders)
- [ ] Locale EN, dark mode, kg visible where relevant
- [ ] Scene 05 is desktop chrome BYOA
- [ ] Scene 02 shows RIR + last performance
- [ ] Scene 07 heatmap is the primary visual
- [ ] `/tour` build + visual spot-check on desktop and mobile

## References

- Tech Plan Capture pipeline table
- Epic Brief demo identity + proof shots
