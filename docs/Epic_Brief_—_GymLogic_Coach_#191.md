# Epic Brief — GymLogic Coach (Context-Aware Chat)

## Summary

This epic introduces **GymLogic Coach** as a **progressive** capability: ship **narrow, high-value flows first** instead of a single large “chat partout.” The **first intended experience** is deliberately simple: a **dedicated entry** (e.g. button) on or next to an **already-created program** where the user types **free-text intent** and gets help grounded in **their** program and exercise pool—**not** a generic LLM.

**Examples of first-wave intents:**

- “Je veux rajouter une autre séance” (cohérent avec le reste du programme).
- “Je veux remplacer tel exercice par un autre parce que j’en ai marre / j’ai mal à …”

The model **explains** on top of **deterministic context** (muscle buckets, volume where relevant, catalog) and returns **safe exercise IDs** only after server validation—same spirit as the shipped AI generators. **Wider** use cases (e.g. coach **during** `WorkoutPage`, balance readouts mid-session), **multi-turn** polish, and **streaming** are **later waves**—same umbrella epic, **sequenced tickets**.

**Calendar / which day to train** remains **out of scope**: sessions are **templates**; the user trains whenever they want. Value is **coherence inside the program**, not a planner.

**Interaction model (first wave):** the coach **proposes** structured changes; the user **validates or rejects in one click** after a clear preview—no copy-paste into the builder on the happy path. **Primary entry:** see [Entry points](#entry-points-proposals-for-v1) (recommended: program detail in Library).

---

## Context & Problem

**Who is affected:** Users who **already have a program** in GymLogic and want to **evolve** it without manually rebuilding the builder from scratch or copy-pasting into an external chat that ignores their library.

**Current state:**

- **AI Workout Generator** and **AI Program Generator** (shipped) use Gemini via edge functions for **one-shot** structured outputs (`file:supabase/functions/generate-workout/index.ts`, `file:supabase/functions/generate-program/index.ts`), with server-side validation of exercise IDs.
- **Builder** supports CRUD on days and exercises, but **iterating by intent** (“add a day like my others”, “swap this for something easier on the shoulder”) is **manual and slow**.
- **WorkoutPage** (`file:src/pages/WorkoutPage.tsx`) holds rich session state; it is a **natural home later** for in-session coach, but **not** the required first slice of this epic.
- **Volume / balance** data exists for rolling windows via `get_volume_by_muscle_group` (`file:src/lib/volumeByMuscleGroup.ts`) and can feed prompts when relevant.

**Pain points:**

| Pain | Impact |
|---|---|
| External LLMs ignore the real program + catalog | Advice is generic or unusable (wrong IDs, wrong equipment). |
| “I want **another** session day” | User needs **coherence** with existing days (split, muscle balance, equipment)—not a calendar. |
| “I’m **sick of** this exercise / **pain** in …” | User needs **grounded swaps** from **their** pool with constraints, not a lecture. |

---

## Goals

| Goal | Measure |
|---|---|
| **Program-evolution entry** | User can open a **simple flow** (button + text) tied to an **existing program** and send intent in natural language (FR/EN). |
| **Grounded responses** | Requests include a **structured program (+ catalog) context**; the model does not contradict facts from that context. |
| **Add session** | User can ask to **add another session**; the result is **coherent** with the other defined days (no fantasy split that ignores existing templates). |
| **Swap exercises** | Replacements use **exercise IDs from the validated pool**; invalid IDs are stripped or repaired server-side (generator-style guardrails). |
| **Progressive roadmap** | **Later** increments can add **WorkoutPage** coach, richer **balance** narration, **multi-turn** polish—without blocking v1 on them. |
| **Operational parity** | Quota/logging fits existing `ai_generation_log` patterns; coach/program-evolution usage is attributable (e.g. distinct `source`—Tech Plan). |
| **i18n** | New strings for entry, input placeholder, errors, quota, timeouts (FR/EN). |
| **Propose → validate in one click** | User never **recopies** suggestions into the builder by hand: the coach returns a **structured proposal**; the user **accepts** or **rejects** in **one primary action** (see [First-wave UX](#first-wave-ux-propose-and-validate)). |

---

## First-wave UX: propose and validate

The first wave is **not** “text answer only, user fixes the program manually.” It is a **dedicated flow**:

1. User states intent (free text) in the coach entry.
2. System returns a **proposal** grounded in context—ideally **structured** (e.g. list of edits: add day, replace exercise X by Y) plus short rationale.
3. User sees a **clear preview** of what would change (diff-style or summary—Tech Plan).
4. **One click to confirm** (“Apply” / “Valider”) **or** **one click to discard** (“Cancel” / “Not now”)—no mandatory multi-step wizard for the happy path.

**Reject** must be cheap (no guilt, state unchanged). **Apply** runs the same mutations the builder would use (RPCs / existing APIs—Tech Plan), so data integrity stays in one place.

This preserves **trust** (human stays in control) and **value** (no copy-paste tax).

---

## Entry points (proposals for v1)

The coach must be **visible** where users already think “this is **my** program.” Concrete options in the current app shell:

| Priority | Placement | Rationale |
|---|---|---|
| **A — Recommended** | **`ProgramDetailSheet`** (`file:src/components/library/ProgramDetailSheet.tsx`) — primary CTA next to existing **Edit** (e.g. “Coach” / “Modifier avec l’IA”). User has **just opened** a program from **Library → Programs**; context (`program_id`) is obvious. | Highest **intent match**: overview of days before editing; good moment to say “add a day” or “swap something.” |
| **B — Strong secondary** | **Builder** top bar for `file:src/pages/BuilderPage.tsx` / route **`/builder/:programId`** | User is already **deep in edits**; coach is a **power shortcut** (e.g. swap without hunting the library). Slightly narrower audience than A. |
| **C — Optional** | **Program card** overflow / secondary action on the program grid (`file:src/components/library/ProgramCard.tsx`) | Improves discoverability from the list without opening the sheet first; can duplicate entry to A if confusing—**Tech Plan** picks one primary to avoid three identical buttons. |

**Recommendation for v1:** ship **A** as the **canonical** entry; add **B** in the same wave or the next ticket if UX research shows users expect the coach **while** editing.

---

## Scope

**In scope (epic umbrella; not all in the first ticket):**

1. **Program-level context** — Server-authoritative snapshot of the **program** (days, exercises, snapshots, equipment/muscle) the user can access (RLS), suitable for prompts. **Concrete shape** for the Tech Plan.
2. **Edge function** (e.g. `coach-chat` or `evolve-program` — naming TBD) — **text in + context + locale**; returns assistant text and optional **validated** `suggested_exercise_ids` / structured **proposed edits** (Tech Plan decides). **Not** a bolt-on to `generate-workout`’s request shape.
3. **System prompt(s)** — “Coach” persona, respect for deterministic summaries, **swap/catalog** rules aligned with generators.
4. **Deterministic metrics** — Pre-LLM buckets (Push/Pull/Legs/Core, etc.) and optional rolling volume so the model **does not invent** counts.
5. **UI: first wave** — **Entry** (see [Entry points](#entry-points-proposals-for-v1)) + **text input** + **proposal preview** + **single-click apply / dismiss** per [First-wave UX](#first-wave-ux-propose-and-validate). **Not** mandatory to ship the full `WorkoutPage` sheet in the first milestone.
6. **Quota & logging** — Extend AI logging so **coach / program evolution** is tracked (exact caps in Tech Plan).
7. **Later waves (same epic, separate tickets):** in-session coach on `WorkoutPage`, **client overlay** for live set progress vs DB, multi-turn history, streaming.

**Out of scope:**

- **Streaming** in the first wave (optional later).
- **Choosing which calendar day to train** — not the product’s job.
- **Silent auto-apply** of program edits — the model **never** writes to the DB without the user’s **explicit one-click** confirmation (see [First-wave UX](#first-wave-ux-propose-and-validate)).
- **Admin prompt editor**, voice, push notifications.
- Replacing **one-shot** generators.

---

## Delivery approach

This epic is **deliberately** delivered as **several small, well-scoped tickets** on a **narrower use case first**—avoid a **brittle** “big chat” that does everything badly.

- **First wave (example):** **evolve existing program** via **button + text** — intents such as **add a session** and **swap an exercise** (fatigue, discomfort, boredom). Ship **end-to-end value** (input → grounded proposal → **one-click** apply or dismiss) before expanding surface area.
- **Later waves:** additional **intents**, **WorkoutPage** entry, **live session overlay**, **balance** in-session, **multi-turn** polish—each as its own increment.
- **Interim releases are OK:** early milestones satisfy **a subset** of goals; the Goals table describes the **full** epic over time.

---

## Success Criteria

- **Numeric:** Any returned **exercise IDs** are **100%** valid for the user’s catalog and constraints in the **program-evolution** flow (server-side validation).
- **Qualitative:** “**Add another session**” produces suggestions **consistent** with the existing program days (no split that ignores existing templates).
- **Qualitative:** “**Replace this exercise** …” (reason: fatigue, pain, etc.) feels **grounded** in the user’s pool—not generic ChatGPT.
- **Qualitative:** First-wave UX is **simple** (discoverable entry, clear text field, **preview**, **one-click** validate or cancel)—not a maze; **no** reliance on manual copy-paste into the builder for the happy path.
- **Later waves:** additional success criteria (e.g. in-session overlay, ephemeral chat) when those tickets are scoped.

---

## Dependencies

- **Shipped AI infrastructure:** Gemini via Supabase Edge Functions, JWT, `file:supabase/functions/_shared/aiQuota.ts`, `ai_generation_log`.
- **Shipped generators:** Validation patterns (`file:supabase/functions/generate-workout/validate.ts` spirit).
- **Program builder & data model:** `workout_days`, `workout_exercises`, program identity (`file:src/types/database.ts`, builder routes). Library surfaces for entry: `file:src/components/library/ProgramDetailSheet.tsx`, `ProgramCard`, `ProgramsTab` — see [Entry points](#entry-points-proposals-for-v1).
- **Volume / muscle taxonomy:** `file:src/lib/volumeByMuscleGroup.ts`, `file:src/lib/muscleMapping.ts` when balance metrics are included.
- **WorkoutPage / session atoms** — **dependency for later waves**, not for the minimal first wave.

---

## Resolved product decisions

- **Narrow first slice:** **Program evolution** (button + text) before **full** in-session coach on `WorkoutPage`.
- **Progressive features:** same epic, **multiple tickets**; see [Delivery approach](#delivery-approach).
- **Deterministic first, LLM second** for anything countable (buckets, volume windows).
- **Calendar is out of scope** — coherence is **between session templates**, not weekdays.
- **Separate edge function** from `generate-workout` / `generate-program` contracts.
- **Hybrid server + client overlay** is **required for in-session** coach (later wave); **program-only** snapshot may suffice for **first wave**.
- **Propose → human validates (one click):** resolved — see [First-wave UX](#first-wave-ux-propose-and-validate); no copy-paste happy path.
- **Primary entry (v1):** **`ProgramDetailSheet`** recommended; builder as secondary — see [Entry points](#entry-points-proposals-for-v1).

---

## Risks & questions for the Tech Plan phase

- **Preview clarity:** User must understand **exactly** what will change before applying (diff copy, undo strategy—Tech Plan).
- **Partial failure:** If **apply** fails mid-way (network, constraint), rollback / error message behavior.
- **Quota** for program-evolution vs workout/program generation; cost ceiling.
- **Multi-turn** for “clarify intent” in the same flow—v1 single-turn vs minimal follow-up.
- **Offline:** network required; mirror generator patterns.

---

## References

- GitHub issue: [#191 — Feat: AI-Powered 'GymLogic Coach' (Context-Aware Chat)](https://github.com/PierreTsia/workout-app/issues/191)
- Product vision: `file:docs/PRD.md`
- Related shipped epic (pattern reference): `file:docs/done/Epic_Brief_—_AI_Workout_Generator.md`

When you are ready, say **create tech plan** (or **split into tickets**) to break this epic into sequenced work from this brief.
