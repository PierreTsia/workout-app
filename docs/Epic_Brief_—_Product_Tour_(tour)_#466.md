# Epic Brief — Product Tour (/tour)

## Summary

Ship a new marketing page at `/tour` (nav: **Tour**) on the Astro mini-site that tells GymLogic’s product story as a seven-scene journey with dry-fun product facts, a desktop sticky split-stage (rail + device), dual CTAs (**Open the app** / **Connect your agent**), and fresh EN dark-mode captures from a dedicated **Prime Mover** demo account — with distinct per-scene placeholders acceptable until captures land. Leaves `/` and `/about` unchanged; sells capability, not the agentic-engineering pitch. Visual chrome reference: Stitch split-stage frame (scene 02 resting state); Astro is source of truth.

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
2. As a **visitor on desktop**, I want a sticky scene rail (01–07) with a large device stage that updates as I scroll or select, so that I can explore all capabilities without a zig-zag brochure layout.
3. As a **visitor on mobile**, I want a linear 01–07 journey with the same titles and ledes, so that the story works on a phone.
4. As a **visitor**, I want dry product-fact copy (not urgency or fake personas), so that the page feels like GymLogic, not generic fitness SaaS.
5. As a **visitor**, I want each scene’s visual to show a distinct, realistic dark UI (capture or high-fidelity placeholder), so that I see the product, not stock gym photos or a repeated mock.
6. As a **visitor on scene 02**, I want sets / RIR / last performance called out, so that the session floor is concrete.
7. As a **visitor on scene 05**, I want a desktop-window BYOA / MCP story (agent → program in app), so that I understand bring-your-own-agent, not only in-app chat.
8. As a **visitor on scene 06**, I want exercise detail with bilingual instructions + video emphasized, so that the catalog wedge is clear.
9. As a **visitor on scene 07**, I want heatmap as the primary visual with per-exercise graphs / Strength Balance / achievements as supporting facts, so that “over time” isn’t an analytics dashboard dump.
10. As a **visitor**, I want primary **Open the app** → `https://gymlogic.me` and secondary **Connect your agent** → `/connect/claude`, with no sellsy closer headline above the doors, so that I can pick a door after wanting the product.
11. As a **site visitor**, I want **Tour** in the header / mobile nav without a homepage redesign, so that the page is discoverable.
12. As a **returning visitor with `prefers-reduced-motion`**, I want the Tour usable without scroll theater (click rail and/or linear access to all scenes), so that accessibility isn’t optional.
13. As a **marketer / demoer**, I want EN-only v1 copy and consistent EN dark captures from **Prime Mover**, so that demos are restageable and coherent.
14. As a **future localizer**, I want FR Tour deferred explicitly, so that v1 doesn’t block on i18n plumbing in `web/`.

### Success measures

| Story # | Measure |
|---|---|
| 2 | Desktop shows all seven rail labels; stage changes with scroll or click (manual QA) |
| 10 | Both CTAs hit the locked URLs (link check / smoke) |
| 12 | With reduced motion, all seven scenes remain reachable |

---

## Scope

**In scope:**
- New `file:web/src/pages/tour.astro` (or equivalent) + components for hero, **Tour Split Stage**, dual doors
- Nav link **Tour** in Header / MobileNav only (no homepage redesign)
- Chapter map + banked microcopy (titles + ledes; scene 02 supporting facts)
- Desktop: sticky split (rail + stage) required in v1; motion = CSS scroll / crossfade / focal zoom; no gen-AI video
- Mobile: linear 01–07
- Design tokens via existing mini-site + `file:web/DESIGN.md`; Stitch as visual reference only
- Capture pipeline: **Prime Mover** EN dark demo account; seven distinct proof shots (phone vs desktop for scene 05)
- Placeholders OK to ship if visually distinct per scene; replace with real captures in-epic when ready
- Dual doors only under the CTA band — no “Start building” / urgency headline
- Glossary term **Product Tour** + ADR: Tour is a separate `/tour` surface from the agentic homepage

**Chapter map (locked):**

| # | Title | Feature tags | Proof shot |
|---|---|---|---|
| 1 | Get a program | AI / template / blank · program draft preview · Embedded Agent (supporting) | Program draft preview |
| 2 | Train the session | Sets table · RIR · last performance | Sets table mid-set |
| 3 | Progress on purpose | Progression engine / Progression Suggestion | In-session suggestion UI |
| 4 | One-off days | Quick Workout AI (preview + rationale) | Preview + rationale |
| 5 | Bring your agent | MCP / BYOA (`create_program` via External MCP Client) | Desktop agent conversation |
| 6 | Know the movement | Exercise detail · bilingual instructions · video · body map | Detail with instructions + video visible |
| 7 | See yourself over time | History heatmap (primary) · per-exercise graphs · Strength Balance · achievements / cycles | Heatmap primary; others supporting |

**Banked ledes:**
1. Three ways in; the money shot is the draft you accept or reject.
2. Log the work without a spreadsheet brain.
3. Next load from last session + RIR — add weight, add reps, hold, or plateau.
4. Off-program day — constraints in, one session out, you decide before you lift.
5. Bring your own agent; the app is the body — data, catalog, persistence.
6. 360+ curated exercises — precise explainers and demos.
7. Consistency and diagnosis — not an analytics dashboard page.

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

- `/tour` ships with hero, seven scenes, dual doors, **Tour** in nav
- Desktop **Tour Split Stage** is the interaction model (not zig-zag feature rows)
- Copy matches banked titles / ledes; voice stays dry-fun product facts
- Seven distinct visuals (captures or approved placeholders) — no repeated stock mock
- Scene 05 uses desktop chrome for BYOA
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
