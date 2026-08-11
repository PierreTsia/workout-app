# Epic Brief — Product Tour (/tour)

## Summary

Ship a new marketing page at `/tour` (nav: **Tour**) on the Astro mini-site that tells GymLogic’s product story as a six-scene journey with dry-fun product facts, a desktop sticky split-stage (rail + device), dual CTAs (**Open the app** / **Connect your agent**), and fresh EN dark-mode captures from a dedicated **Prime Mover** demo account — with distinct per-scene placeholders acceptable until captures land. Leaves `/` and `/about` unchanged; sells capability, not the agentic-engineering pitch. Visual chrome reference: Stitch split-stage frame (scene 02 resting state); Astro is source of truth. Quick Workout lives inside scene 1 (onboarding), not as its own chapter.

---

## Context & Problem

**Who is affected:** Prospective lifters and AI-curious power users landing on the marketing site; anyone demoing GymLogic (CEO/partner walkthroughs).

**Current state:**
- Homepage (`file:web/src/pages/index.astro`) leads with “The agentic workout app” / MCP / open-source
- Product capabilities (session floor, progression, Quick Workout, BYOA, catalog explainers, history/graphs, Strength Balance, achievements) are under-told as a coherent journey
- Stitch explorations produced a usable **chrome lock** (split rail + stage, scene 02 resting state) but not shippable assets or scroll behavior

**Pain points:**

| Pain | Impact |
|---|---|
| Marketing undersells the gym-floor product | Lifters bounce before understanding value |
| Capabilities scattered across app + README | No single demoable narrative |
| Stitch zig-zag / void / truncated gens | Design exploration burned time; need a code-owned **Product Tour** |

---

## User Stories

1. As a **prospective lifter**, I want a clear Tour of what GymLogic does, so that I can decide whether to open the app.
2. As a **visitor on desktop**, I want a sticky scene rail (01–06) with a large device stage that updates as I scroll or select, so that I can explore all capabilities without a zig-zag brochure layout.
3. As a **visitor on mobile**, I want a linear 01–06 journey with the same titles and ledes, so that the story works on a phone.
4. As a **visitor**, I want dry product-fact copy (not urgency or fake personas), so that the page feels like GymLogic, not generic fitness SaaS.
5. As a **visitor**, I want each scene’s visual to show a distinct, realistic dark UI (capture or high-fidelity placeholder), so that I see the product, not stock gym photos or a repeated mock.
6. As a **visitor on scene 02**, I want sets / RIR / rest timer called out, so that the session floor is concrete.
7. As a **visitor on scene 04**, I want a desktop-window BYOA / MCP story (agent → program in app), so that I understand bring-your-own-agent, not only in-app chat.
8. As a **visitor on scene 05**, I want exercise detail with bilingual instructions + video emphasized, so that the catalog wedge is clear.
9. As a **visitor on scene 06**, I want heatmap as the primary visual with per-exercise graphs / Strength Balance / achievements as supporting facts, so that “over time” isn’t an analytics dashboard dump.
10. As a **visitor**, I want primary **Open the app** → `https://gymlogic.me` and secondary **Connect your agent** → `/connect/claude`, with no sellsy closer headline above the doors, so that I can pick a door after wanting the product.
11. As a **site visitor**, I want **Tour** in the header / mobile nav without a homepage redesign, so that the page is discoverable.
12. As a **returning visitor with `prefers-reduced-motion`**, I want the Tour usable without scroll theater (click rail and/or linear access to all scenes), so that accessibility isn’t optional.
13. As a **marketer / demoer**, I want EN-only v1 copy and consistent EN dark captures from **Prime Mover**, so that demos are restageable and coherent.
14. As a **future localizer**, I want FR Tour deferred explicitly, so that v1 doesn’t block on i18n plumbing in `web/`.

### Success measures

| Story # | Measure |
|---|---|
| 2 | Desktop shows all six rail labels; stage changes with scroll or click (manual QA) |
| 10 | Both CTAs hit the locked URLs (link check / smoke) |
| 12 | With reduced motion, all six scenes remain reachable |

---

## Scope

**In scope:**
- New `file:web/src/pages/tour.astro` (or equivalent) + components for hero, **Tour Split Stage**, dual doors
- Nav link **Tour** in Header / MobileNav only (no homepage redesign)
- Chapter map + banked microcopy (titles + ledes; scene 02 supporting facts)
- Desktop: sticky split (rail + stage) required in v1; motion = CSS scroll / crossfade / focal zoom; no gen-AI video
- Mobile: linear 01–06
- Design tokens via existing mini-site + `file:web/DESIGN.md`; Stitch as visual reference only
- Capture pipeline: **Prime Mover** EN dark demo account; six scenes × three shots (phone vs desktop for BYOA)
- Placeholders OK to ship if visually distinct per scene; replace with real captures in-epic when ready
- Dual doors only under the CTA band — no “Start building” / urgency headline
- Glossary term **Product Tour** + ADR: Tour is a separate `/tour` surface from the agentic homepage

**Chapter map (locked)** — SoT: `file:web/src/lib/tourScenes.ts`. Asset filenames keep a legacy `05*`/`06*`/`07*` prefix for BYOA / catalog / history.

| # | Title | Feature tags | Proof shot |
|---|---|---|---|
| 1 | Start with a program | AI draft · Quick Workout constraints · Quick Workout preview | AI chat → QW triad |
| 2 | Train the session | Sets table · RIR · rest timer | Session floor triad |
| 3 | Progress on purpose | Progression Suggestion (weight-up / hold / plateau) | In-session suggestion UI |
| 4 | Bring your own agent | MCP / BYOA (`create_program` via External MCP Client) | Desktop agent conversation (`05*`) |
| 5 | Know the movement | Exercise detail · bilingual instructions · video | Detail with instructions + video (`06*`) |
| 6 | See yourself over time | History heatmap (primary) · Strength Balance · achievements | Heatmap primary; others supporting (`07*`) |

**Banked ledes:**
1. AI draft, build it yourself, or a Quick Workout — onboarding that gets you lifting the same day.
2. Log the work without a spreadsheet brain.
3. Suggestions from last session and RIR — you confirm the call.
4. Your agent reads your training data and can evaluate, create, and update programs — the app stays the system of record.
5. A curated, searchable catalog — every movement explained in EN and FR, with a demo when you need the visual.
6. Your full training story in one place — history, progress, and the wins along the way.

**Out of scope:**
- Redesign of `/` or `/about` (beyond Tour nav)
- FR localization of Tour
- Gen-AI video / Kling animation pass
- In-app PWA Tour route
- Changing MCP connect guides’ content (link only)
- Perfect pixel-parity with every Stitch iteration
- Sellsy closers, zig-zag feature rows, repeated stock mocks

---

## Success Criteria

- `/tour` ships with hero, six scenes, dual doors, **Tour** in nav
- Desktop **Tour Split Stage** is the interaction model (not zig-zag feature rows)
- Copy matches banked titles / ledes; voice stays dry-fun product facts
- Six scenes of distinct visuals (captures or approved placeholders) — no repeated stock mock
- Scene 04 uses desktop chrome for BYOA
- CTAs: Open the app → `https://gymlogic.me`; Connect your agent → `/connect/claude`; no sellsy headline above the doors
- `prefers-reduced-motion` respected; page remains fully navigable
- Homepage agentic pitch unchanged
- **Product Tour** glossary term + ADR filed

---

## References

- GitHub [#466](https://github.com/PierreTsia/workout-app/issues/466)
- `file:web/DESIGN.md`
- `file:web/stitch/PRODUCT_TOUR_REGEN_PROMPT.md`
- Stitch remix (exploration): https://stitch.withgoogle.com/projects/1596884641132397118
- ADR `file:docs/adr/0013-product-tour-separate-from-homepage.md`
