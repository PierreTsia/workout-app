# T216 — Ceremony motion and reduced-motion

## Goal

Quiet FX: the single-gold screen is the emotional reference; the burst is the same product with more medals. Hero scale + rank glow; sparse burst; Diamond-only purple/cyan squares behind type; `prefers-reduced-motion` is static. Stories: 14–16.

## Mode

AFK

## Slice

CSS/tokens → overlay FX gated on `useMediaQuery("(prefers-reduced-motion: reduce)")` → overlay tests

## Dependencies

T214 (hero exists to hang glow/scale on)

## Scope

### Motion (when motion is allowed)

- Hero medal scale `0 → 1.15 → 1` (reuse/adjust `.achievement-badge-reveal`; do not invent a second animation system unless the existing keyframes can’t express the overshoot)
- Rank-colored radial glow **behind the hero only** (existing `.achievement-glow-*` / `.achievement-rank-glow`)
- Single / non-Diamond: sparse dust + short particle burst around the medal (existing `.achievement-particle-burst` is the starting point — keep it short, not a glitter storm)
- Diamond hero **only**: purple `#a855f7` / cyan `#67e8f9` square particles, **one burst**, then settle. Stitch “Diamond Drama” 300-particle infinite rain is the ceiling, **not** the default. Particles `z-index` behind title/chip/threshold/Equip
- Supporting medals: slide in ~120ms after the hero
- Do **not** recolor the backdrop gold or purple. Accent `#00c9a7` stays on Equip (T215)

### Reduced motion

`useMediaQuery("(prefers-reduced-motion: reduce)")` from `file:src/hooks/useMediaQuery.ts`:
- No scale overshoot (opacity/static medals)
- No particle burst, no Diamond rain
- No supporting slide delay — they’re just there
- Hierarchy/layout unchanged

### Tests

In `AchievementUnlockOverlay.test.tsx`:
- Default: hero has the reveal/glow class (or equivalent observable)
- Mock `matchMedia` to `prefers-reduced-motion: reduce` → burst/rain nodes absent or unanimated; medals and copy still present
- Diamond batch: particle layer is behind the title in DOM order / `z-index` (assert title is in the document and particle container is `aria-hidden`)

## Out of Scope

- New rank metal tokens for the chip (T214)
- Playground (T217)
- Confetti / emoji / infinite rain as the default

## Acceptance Criteria

- [ ] Hero glow + short burst on non-reduced motion
- [ ] Diamond-only extra particles, one burst, behind type
- [ ] `prefers-reduced-motion: reduce` → static medals, no burst, no rain
- [ ] Supporting medals appear ~120ms after hero when motion is allowed
- [ ] Overlay reduced-motion test green with Supabase env stripped

## References

- Epic Brief stories 14–16
- Tech Plan FX decision
- Tokens: `file:src/styles/globals.css` (keep `.achievement-glow-*`)
