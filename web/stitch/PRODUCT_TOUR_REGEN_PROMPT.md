# Product Tour — REGEN prompt (active)

**Use this file.** Supersedes the longer draft in `PRODUCT_TOUR_PROMPT.md`.

| | |
|---|---|
| Story | GitHub [#466](https://github.com/PierreTsia/workout-app/issues/466) |
| Original project (shared, API = **READER**) | https://stitch.withgoogle.com/projects/4609752307702766779 |
| Writable remix (API = **OWNER**) | https://stitch.withgoogle.com/projects/1596884641132397118 |
| Design system | Keep `#0f0f13` + `#00c9a7` + Geist (project theme already) |

CLI note: `STITCH_API_KEY` can `generate_screen_from_text` / `edit_screens` only on the owned remix. To land screens in `46097…`, paste this prompt in the Stitch UI while logged in as the project owner.

---

## Prompt (paste into Stitch)

```
REGEN Product Tour for GymLogic — /tour. Dark editorial. DESIGN.md is law.
HARD FAIL if: fewer than seven scene titles (01–07) in the desktop rail; OR desktop artboard is absurdly tall with empty black space (scroll-spacer mistake).

KEEP
- Palette: bg #0f0f13 · accent #00c9a7 · Geist (no Inter/Roboto)
- Sticky header: accent weights icon + GymLogic · nav Tour (active) · Claude connector · Blog · About · CTA “Open app →”
- Voice: dry product facts, English only. No urgency. No fake personas.

════════════════════════════════════════
DESKTOP LAYOUT (1440–1600 wide) — USE THE WIDTH
════════════════════════════════════════
Do NOT stack seven phone mocks in a skinny centered column. That wastes desktop.

After the hero, use a SPLIT STAGE for scenes 01–07:

┌─────────────────────────────────────────────────────────────┐
│  LEFT (~40%)                         RIGHT (~60%)           │
│  sticky scene rail + copy            sticky DEVICE STAGE    │
│  • vertical list 01–07               • one large mock       │
│  • active scene: accent number +     • crossfades when the  │
│    title + 1–2 sentence lede           active scene changes │
│  • inactive: muted titles only       • phone OR desktop     │
│  • short supporting fact lines         window per scene     │
│    under the active lede             • Ken Burns zoom on    │
│                                        money UI region      │
└─────────────────────────────────────────────────────────────┘

CRITICAL — ARTBOARD HEIGHT (Stitch is a STATIC mock, not a scroll engine)
- Desktop Tour artboard MUST fit ≈ 1.5–2.5 viewports total (~1400–2200px tall at 1440 wide). NEVER 10k–17k px.
- Do NOT create empty vertical spacers / “scroll beats” / tall black voids for sticky scroll.
- Show the split stage ONCE, in a single viewport, with scene 02 (or 03) as the active example.
- Annotate on-canvas (small muted note): “Scroll advances rail 01→07; stage crossfades — implemented in code.”
- Optionally show a compact strip of 7 tiny UI thumbnails under the stage (distinct crops) — still inside the same viewport. Not 7 full-height sections.
- Scroll-driven sticky behavior is Astro/CSS later. Stitch only designs the resting composition.

Scroll / motion (annotate only — do not elongate the canvas):
- LEFT rail + RIGHT stage are sticky in product (implied). Active rail item: teal number, brighter title; others dim.
- Stage: soft crossfade + slight float; Ken Burns on money UI region.
- Scene 05 swaps phone → DESKTOP WINDOW (16:10) in the same stage slot.
- Progress cue: thin teal scrub / “02 / 07” near the stage.

INSTANT REJECT layouts (these are the boring defaults — do not ship them):
- Zig-zag / alternating left-right “SCENE #N + image” rows repeated 7 times (classic SaaS template)
- The SAME mock / stock photo / iMac-in-gym image reused for every scene
- Single-column phone stack, equal 7-card grid, bento of feature tiles
- Hero + 1–2 scenes + CTA
- Lifestyle gym photography as the main visual (blurred racks, neon gym rooms)
- Giant empty middle (artboard height ≫ content) — e.g. 17000px desktop with a black void

Visual innovation requirement: ONE sticky device stage, SEVEN distinct UI states.
The scroll experience must feel like a product film, not a brochure.

HERO (first viewport — one composition, full width)
- H1 exactly: What GymLogic actually does
- One short sub: Program, train, progress, ask an agent, see the truth over time.
- Optional quiet hint under sub: “Scroll the tour →” (muted) — no buttons in hero except header CTA.
- NO stats, dashboard chrome, feature pills, cards, badges, floating stickers.
- NO dual device collage (monitor + phone) in the hero — keep hero typography-led; product lives in the stage.

════════════════════════════════════════
MOBILE (390 wide) — SAME STORY, ADAPTED
════════════════════════════════════════
Linear vertical: hero → scenes 01–07 (each: title + lede + one mock) → dual doors.
No sticky split (width too tight). Same titles/ledes/mocks. No alternate story.

SCENES — exact titles (MUST all appear as visible text on desktop)
01 Get a program
   Mock PHONE: program draft preview (multi-day plan before commit).
   Lede: Three ways in; the money shot is the draft you accept or reject.

02 Train the session
   Mock PHONE: sets table mid-set — reps, weight, RIR, last performance.
   Lede: Log the work without a spreadsheet brain.

03 Progress on purpose
   Mock PHONE: in-session progression suggestion (e.g. +2.5 kg).
   Lede: Next load from last session + RIR — add weight, add reps, hold, or plateau.

04 One-off days
   Mock PHONE: Quick Workout preview + short coach-style rationale.
   Lede: Off-program day — constraints in, one session out, you decide before you lift.

05 Bring your agent
   Mock DESKTOP WINDOW (16:10) — NOT a phone.
   Agent conversation that ends with a program landing in GymLogic (BYOA / MCP).
   Lede: Bring your own agent; the app is the body — data, catalog, persistence.

06 Know the movement
   Mock PHONE: exercise detail — structured instructions + video both visible.
   Lede: 360+ curated exercises — precise explainers and demos.

07 See yourself over time
   Mock PHONE: history heatmap as the large visual.
   Supporting lines (not equal cards): per-exercise graphs · Strength Balance.
   Lede: Consistency and diagnosis — not an analytics dashboard page.

DUAL DOORS (after scene 07 — full width, not inside the split)
Calm surface band. Short factual closer (NOT “Ready to… intelligently”).
Buttons: Primary “Open the app” · Secondary outline “Connect your agent”.

MOCK REALISM — SEVEN DIFFERENT FRAMES
Each scene’s stage content MUST be visually distinct (different screen, different crop):
01 draft days list · 02 sets/RIR table · 03 +2.5kg suggestion · 04 QW preview ·
05 desktop agent window · 06 exercise instructions+video · 07 heatmap
GymLogic dark PWA UI (#0f0f13 / #15151c / #1a1a22, teal). Large stage mock — fill the right column.
NOT the same placeholder pasted 7×. NOT wellness dashboards. NOT Material `fitness_center` chrome.
NOT App Store collages or stock “iMac in a gym” photos.

MUST NOT
- Truncate to 01–02 + doors (instant reject)
- Zig-zag alternating feature rows (instant reject — even if all 7 titles are present)
- Reuse one image for multiple scenes (instant reject)
- Purple/indigo glow, glassmorphism stacks, cream+serif
- Cards in hero; 7 equal feature cards; icon rows instead of journey
- Scene 05 as phone chat
- Wrong CTAs (“Pick a plan”, “Join us”, “Stay updated”, “Inspect the tool”)
- Sellsy / urgency closer · emoji · pill clusters · fake testimonials
- Centered skinny phone column wasting desktop width
- Nav inventing Store / Features / Career — stick to Tour · Claude connector · Blog · About
- Empty multi-viewport scroll spacers (static mock ≠ scroll engine)

MOTION (desktop is the showpiece)
1) Sticky split + scroll-driven scene activation
2) Stage crossfade between mocks
3) Ken Burns focal zoom on the money region of the active mock
Honor prefers-reduced-motion (static active scene OK).

OUTPUT
1) Desktop Tour — compact artboard (≤ ~2200px tall): hero + ONE split-stage viewport (rail 01–07 + active stage) + dual doors + footer. No void.
2) Mobile Tour — linear 01–07, same copy, reasonable length (not cinematic emptiness)
QA: count rail labels 01…07 = 7; artboard height sane; no multi-thousand-px black gap.
```

---

## How to run in Stitch UI

1. Prefer the **owned remix** for API + UI parity: https://stitch.withgoogle.com/projects/1596884641132397118  
   Or open the original as owner: https://stitch.withgoogle.com/projects/4609752307702766779
2. Confirm dark + teal + Geist design system is attached.
3. New generation → paste the fenced block → generate **desktop** and **mobile** (same prompt).
4. Reject if: zig-zag rows; same mock ×N; desktop artboard absurdly tall / black void; rail missing titles; mobile is a dashboard; scene 05 is a phone; closer/CTAs are sellsy; wrong H1.

## Generated v2 (CLI → owned remix)

| Screen | ID | URL |
|---|---|---|
| Product Tour Desktop v2 | `403b11e75d054e03bcdc1494f1be1fad` | https://stitch.withgoogle.com/projects/1596884641132397118/screens/403b11e75d054e03bcdc1494f1be1fad |
| Product Tour Mobile v2 | `efc39ed3e0d840879d8ad15c96bdff68` | https://stitch.withgoogle.com/projects/1596884641132397118/screens/efc39ed3e0d840879d8ad15c96bdff68 |
| Product Tour Mobile v2 (2nd pass) | `efd27497acce47f7839e260b37dcb08a` | https://stitch.withgoogle.com/projects/1596884641132397118/screens/efd27497acce47f7839e260b37dcb08a |

Original project `46097…` is API-READER only — paste this prompt there yourself if screens must live in that project.
