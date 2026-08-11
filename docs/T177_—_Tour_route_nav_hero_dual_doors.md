# T177 — Tour route + nav + hero + dual doors

## Goal

Ship a reachable `/tour` page on the Astro mini-site with banked hero copy, dual-door CTAs (no sellsy headline), and a **Tour** nav link in Header / MobileNav / Footer. Addresses Epic stories 1, 10, 11.

## Mode

**AFK** — mechanical; copy and URLs are locked in the Epic Brief / Tech Plan.

## Slice

`tour.astro` → BaseLayout SEO → TourHero + TourDoors → Header/MobileNav/Footer nav → `astro build`

## Dependencies

None (Epic Brief + Tech Plan + ADR 0013 already filed).

## Scope

### Page

- Add `file:web/src/pages/tour.astro` wrapping `BaseLayout`
- Title/description for Product Tour (indexable)
- Compose `TourHero` + `TourDoors` (scenes/stage deferred)

### Components

| File | Role |
|---|---|
| `file:web/src/components/tour/TourHero.astro` | H1 “What GymLogic actually does” + banked sub |
| `file:web/src/components/tour/TourDoors.astro` | Primary Open the app → `https://gymlogic.me`; secondary Connect your agent → `/connect/claude`; no headline |

### Nav

- Insert `{ href: '/tour', label: 'Tour' }` in Header, MobileNav, Footer (sensible icon)

### Tests

- Pure assertion module or page-level smoke: hero strings + CTA hrefs exported/testable (e.g. shared constants used by components), or Vitest in `web/` for a small `tourCopy` export
- `npm run build` in `web/` succeeds

## Out of Scope

- Scene catalog, DeviceFrame, mobile linear, desktop sticky island
- Captures / placeholders beyond optional empty slots
- Homepage redesign

## Acceptance Criteria

- [ ] `GET /tour` (dev or preview) renders banked H1 + sub
- [ ] Dual doors link to gymlogic.me and `/connect/claude` with no sellsy closer headline
- [ ] Tour appears in desktop nav, mobile nav, and footer
- [ ] Active nav state works on `/tour`
- [ ] `web` build passes
- [ ] At least one automated test covers banked copy/CTA constants or rendered output

## References

- Epic Brief `file:docs/Epic_Brief_—_Product_Tour_(tour)_#466.md`
- Tech Plan `file:docs/Tech_Plan_—_Product_Tour_(tour)_#466.md`
- ADR `file:docs/adr/0013-product-tour-separate-from-homepage.md`
