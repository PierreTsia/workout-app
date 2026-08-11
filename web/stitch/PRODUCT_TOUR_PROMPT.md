# Stitch prompt — GymLogic Product Tour (`/tour`)

> **Active regen prompt:** [`PRODUCT_TOUR_REGEN_PROMPT.md`](./PRODUCT_TOUR_REGEN_PROMPT.md)  
> Use that file for the next Stitch iteration (critique fixes: full 7 scenes, mobile story parity, scene 05 desktop BYOA, no sellsy). This file stays as the longer original brief.

Paste into Google Stitch **after** attaching / importing `web/DESIGN.md`.
Source of truth for story decisions: GitHub issue [#466](https://github.com/PierreTsia/workout-app/issues/466).

Generate a **desktop marketing page** (1440× wide artboard) plus a **mobile** variant (390 wide). Dark theme only. Follow DESIGN.md tokens exactly.

---

## Prompt (copy below)

```
Design a long-scroll marketing page for GymLogic called “Product Tour” at URL /tour.

IMPORT DESIGN SYSTEM: Use the attached DESIGN.md (GymLogic Marketing) for all colors, type, radius, spacing, buttons, and do’s/don’ts. Do not invent a second palette. No purple. No cream. No light mode. No Inter/Roboto. Geist + mint accent on near-black.

BRAND
- Product: GymLogic — serious strength-training PWA + MCP (“bring your own agent”).
- Wordmark in sticky header: accent stroke weights icon + “GymLogic”.
- Header nav: Tour (active) · Claude connector · Blog · About · primary button “Open app →”.
- Page is English only.

PAGE JOB
Make a mid/average lifter who is getting serious want the product, then offer two doors at the end:
1) Primary: “Open the app” → gymlogic.me
2) Secondary: “Connect your agent” → /connect/claude
No sellsy urgency. Voice = dry product facts, precise, a little witty — not second-person coach hype, not fake persona stories.

HERO (first viewport — one composition only)
- H1: What GymLogic actually does
- Sub (one short sentence): Program, train, progress, ask an agent, see the truth over time — the product surface, not the pitch.
- Optional quiet secondary text only; NO stats, NO feature pills, NO cards, NO badges on media.
- Brand must remain the strongest signal in the chrome; headline must not overpower the wordmark.

THEN: 7 JOURNEY SCENES
Each scene = short title + 1–2 sentence product-fact lede + ONE primary device mock (real-UI placeholder) with a subtle focal zoom/crop on the money region. Supporting facts as short lines under the mock — never a 3-equal-card row.

Use placeholder screenshots that look like GymLogic dark-mode UI (near-black surfaces, mint accent, Geist-like UI type). Label each mock with a small caption of what the shot is.

Scene 01 — Get a program
Features: AI / template / blank paths · program draft preview · Embedded Agent (supporting)
Proof mock (phone): program draft preview — multi-day plan with exercises before commit.
Lede idea: Three ways in; the money shot is the draft you accept or reject.

Scene 02 — Train the session
Features: Sets table · RIR · last performance
Proof mock (phone): mid-set sets table with reps/weight/RIR and last performance visible.
Lede idea: The daily job — log the work without a spreadsheet brain.

Scene 03 — Progress on purpose
Features: Progression engine / Progression Suggestion
Proof mock (phone): in-session progression suggestion UI (e.g. weight up +2.5 kg style popover/pill).
Lede idea: Next load from last session + RIR — add weight, add reps, hold, or flag a plateau.

Scene 04 — One-off days
Features: Quick Workout AI
Proof mock (phone): Quick Workout preview with short coach-style rationale.
Lede idea: Off-program day — constraints in, single session out, you decide before you lift.

Scene 05 — Bring your agent
Features: MCP / BYOA — External MCP Client writes via create_program
Proof mock (DESKTOP window chrome, not phone): AI agent chat (Claude-like) that ends with a program landing in GymLogic.
Lede idea: Bring your own agent; the app is the body — data, catalog, persistence.

Scene 06 — Know the movement
Features: Exercise detail · bilingual instructions · video · body map
Proof mock (phone): exercise detail scrolled so structured instructions + video player are both visible (EN UI).
Lede idea: 360+ curated exercises — precise explainers and demos, not junk catalog filler.

Scene 07 — See yourself over time
Features: History heatmap (primary) · per-exercise graphs · Strength Balance · achievements / cycles
Proof mock (phone): history heatmap as the hero frame; below it, two short factual lines calling out per-exercise graphs and Strength Balance (do NOT make three equal poster cards).
Lede idea: Consistency and diagnosis without turning the page into an analytics dashboard.

CLOSING — DUAL DOORS
Full-width calm band (surface background). Short factual closer. Two buttons side by side on desktop, stacked on mobile:
- Primary filled accent: Open the app
- Secondary outline: Connect your agent
No newsletter, no social proof logos, no “trusted by”.

MOTION / COMPOSITION NOTES (for the design, annotate if needed)
- Suggest scroll presence: soft fade-in of scenes, device mock slight float, Ken Burns–style focal zoom into the highlighted UI region of each screenshot.
- Keep motion tasteful — 2–3 intentional ideas, not confetti.
- Annotate focal zoom targets on each mock (e.g. “zoom: RIR column”, “zoom: video player”, “zoom: heatmap streak”).

LAYOUT RULES
- Prose column ~max 768px; device mocks may sit wider.
- Generous vertical spacing between scenes.
- Sticky header that gains blur/background on scroll.
- Footer: minimal — logo, short line, links (GitHub, Blog, About, Privacy) — match an editorial docs site, not a SaaS mega-footer.

EXPLICIT ANTI-PATTERNS (reject if you start drawing them)
- Purple/indigo AI gradients, glow orbs, glassmorphism stacks
- Warm cream + serif display + terracotta
- Hero cards, floating promo stickers on screenshots
- Feature-matrix grids or icon rows replacing the journey
- Light-mode App Store collage
- Emoji, pill clusters, fake testimonial avatars
- Naming external model brands in body copy except the existing nav/CTA path to “Claude connector”

OUTPUT
1) Desktop full-page Tour
2) Mobile full-page Tour
3) Optional: one zoomed detail artboard showing Scene 02 sets table with focal crop annotation
```

---

## How to use in Stitch

1. Create / open a Stitch project for GymLogic marketing.
2. Import `web/DESIGN.md` as the project design system (DESIGN.md).
3. Paste the fenced prompt above.
4. Generate desktop + mobile.
5. Iterate with short follow-ups, e.g.:
   - “Scene 05 must be desktop chrome, not a phone.”
   - “Remove all cards from the hero.”
   - “Scene 07: heatmap only as large visual; Balance/graphs as text lines.”
   - “Tone down shadows; flatter planes per DESIGN.md.”

## After Stitch

Export references → implement in `web/src/pages/tour.astro` (or equivalent) using existing Astro + Tailwind tokens already mirrored in DESIGN.md. Replace placeholder screens with real EN dark-mode captures from the `Prime Mover` demo account (issue #466).
