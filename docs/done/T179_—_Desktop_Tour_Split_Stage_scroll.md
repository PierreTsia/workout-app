# T179 — Desktop Tour Split Stage (scroll)

## Goal

Ship the kick-ass desktop **Tour Split Stage**: sticky pin, `7 × (100vh - header)` beats, IntersectionObserver scene activation, click rail, stage crossfade. Addresses Epic story 2 (and desktop presentation of 6–9).

## Mode

**AFK** — interaction model locked in Tech Plan.

## Slice

`getImage` in `tour.astro` → `TourSplitStage.tsx` (`client:load`, md+) → pin/IO/rail/stage → DeviceFrame

## Dependencies

T178.

## Scope

### Island

- `file:web/src/components/tour/TourSplitStage.tsx` — desktop only (`hidden md:block` wrapper + `client:load`)
- Pin height ≈ `7 × (100vh - var(--header-h, 4rem))`
- Sticky panel with rail (~40%) + stage (~60%)
- IO on beat markers → `activeIndex`; click rail → scrollTo beat
- Stage crossfade between resolved scene images
- Progress `NN / 07`
- Pass serializable resolved scenes (src/width/height/…) from Astro

### Wiring

- `tour.astro` resolves images and mounts island for `md+`
- Mobile linear remains the small-screen path

### Tests

- Unit/behavior tests for scene index selection helpers (e.g. which beat is active given scroll ratios) and/or rail click handler pure logic
- Manual: scroll through all 7 on desktop width (document in PR)

## Out of Scope

- Ken Burns focals + reduced-motion full path (T180) — minimal `prefers-reduced-motion` stub OK
- Real captures (T181)
- HITL visual sign-off (T182)

## Acceptance Criteria

- [ ] At `md+`, sticky split is visible; mobile linear hidden
- [ ] Scrolling the pin activates scenes 01→07 (IO)
- [ ] Clicking a rail item scrolls/activates that scene
- [ ] Stage shows the active scene image via DeviceFrame (phone vs desktop chrome)
- [ ] Progress indicator reflects active index
- [ ] Sticky panel always paints content (no empty void mid-scroll)
- [ ] Automated tests cover index/activation helpers
- [ ] `web` build passes

## References

- Tech Plan “Kick-ass scroll sketch” + TourSplitStage responsibilities
- Epic stories 2, 6–9
