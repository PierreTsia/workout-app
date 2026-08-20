# T178 — Scene catalog + DeviceFrame + mobile linear

## Goal

Add the banked six-scene catalog with distinct placeholder assets, a DeviceFrame (phone/desktop), and a linear mobile Tour so `/tour` tells the full story on small screens. Addresses Epic stories 3, 4, 5 (and copy for 6–9).

## Mode

**AFK** — titles/ledes/proof-shot intents locked; placeholders may be generated or cropped distinctly.

## Slice

`tourScenes.ts` → `assets/screenshots/tour/*` → DeviceFrame → TourMobileScenes → `/tour` (md:hidden)

## Dependencies

T177.

## Scope

### Data

- `file:web/src/lib/tourScenes.ts` — six scenes: id, slug, title, lede, facts, device, image import, alt, focal
- Banked titles/ledes exactly as Epic Brief
- Scene 02 facts: last performance, rest timer, RIR (max 3)
- Scene 04 `device: 'desktop'`; others `phone`

### Assets

- Distinct placeholder images under `file:web/src/assets/screenshots/tour/` (not one image reused)

### UI

| File | Role |
|---|---|
| `DeviceFrame` | Phone vs desktop chrome + image |
| `TourMobileScenes.astro` | Linear `#tour-01`…`#tour-06`; visible below `md` |

### Tests

- Vitest: catalog has 6 scenes, unique titles/ledes, scene 04 desktop, ids 1–6
- Build still green

## Out of Scope

- Desktop sticky scroll island (T179)
- Real Prime Mover captures (T181)
- Ken Burns / reduced-motion polish (T180)

## Acceptance Criteria

- [ ] `tourScenes` exports 6 scenes with banked titles + ledes
- [ ] Scene 04 is `desktop`; others `phone`
- [ ] Distinct image files referenced per scene/shot
- [ ] Mobile viewport shows all six scenes in order with DeviceFrame
- [ ] Desktop can hide mobile stack via `md:hidden` (island may still be stub)
- [ ] Automated tests for catalog invariants pass
- [ ] `web` build passes

## References

- Epic Brief chapter map + banked ledes
- Tech Plan Data Model + TourMobileScenes
