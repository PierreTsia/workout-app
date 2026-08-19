---
name: gymlogic-mcp
description: >
  Use the GymLogic MCP server to read a user's workout history, training stats,
  exercise catalog, upcoming programmed days, and to create or replace their active
  multi-day training program. Trigger when the user mentions sport, training,
  workouts, sets, reps, weights, exercises, programmes, séances, musculation, gym,
  or asks for coaching, volume analysis, or program design.
---

# GymLogic MCP Skill

This skill teaches an LLM how to be a competent training coach on top of the [GymLogic](https://gymlogic.me) MCP server. It covers when to invoke each of the **eleven tools** (eight reads, three writes), how to format their parameters, the **propose-confirm-act handshake** required on every write, and the non-obvious quirks that bite zero-shot agents — most importantly the **per-side weight convention for unilateral equipment** (issue [#263](https://github.com/PierreTsia/workout-app/issues/263)).

GymLogic is a French/English workout tracker. The user logs sessions, weights, reps; you read this data and either analyze it (`get_*` reads), shape their multi-day plan with `create_program` (new) or `update_program` (in-place edits — preserves training history), or drop in a single ad-hoc session with `create_workout_day` (Quick Workout — leaves the active program untouched).

---

## When to invoke this skill

Trigger on any sport / training / fitness intent, in **French or English**:

- "C'est quoi mon prochain training ?", "Montre mes 5 dernières séances", "Mon volume push/pull du mois ?"
- "What did I train this week?", "Search for chest exercises with dumbbells", "How's my training volume?"
- "Donne-moi un programme 4 jours full body" → design + `create_program`
- "Remplace mon programme actuel par X" → `create_program` (replaces active program)
- "Crée-moi une séance d'aujourd'hui" / "fais-moi un quick workout pecs/triceps maintenant" → `create_workout_day` (single session, **leaves the active program untouched**)
- "I want a quick workout for today, just one session" / "give me a 30-min full-body workout right now" → `create_workout_day`
- Ambiguous coaching prompts ("je stagne au bench") → start with `get_workout_history` + `get_training_stats`, then advise

Do **not** invoke for:

- Pure exercise-form questions answerable from general knowledge (unless the user asks for *their* version, then use `get_exercise_details`).
- Nutrition / sleep / non-training topics — out of scope.

---

## Authentication

Two paths; **PAT is recommended**.

### Personal Access Token (PAT) — recommended

Long-lived bearer token, created by the user at [gymlogic.me/account/api-tokens](https://gymlogic.me/account/api-tokens). Format: `glp_…`. The runtime injects it as:

```http
Authorization: Bearer glp_<token>
```

Stable, no refresh dance. Revocation is immediate (next call returns `401`).

### OAuth 2.1 — alternative

Dynamic client registration, browser consent at `www.gymlogic.me/oauth/consent`. Use only if the user explicitly requests it or PAT setup is impossible. See per-client guides in [`docs/mcp-connect/`](../../docs/mcp-connect/) for setup.

### Server endpoint

```
https://mcp.gymlogic.me/functions/v1/mcp
```

All eleven tools 401 if no auth context. The tool response will be `Authentication required — please provide a valid Bearer token.` — surface that to the user and ask them to (re)connect.

---

## Tool reference (intent → tool)

Eleven tools total — eight reads, three writes.

### Catalog tools — which one when

The catalog has three tools that look superficially similar. Pick by **what you already know** about the exercise(s) you're after:

| You already know… | Tool | Why |
|---|---|---|
| Specific exercise NAMES (e.g. `["bench press", "squat", "leg press"]`) and need UUIDs to build/edit a program | `resolve_exercises` (since v0.5.0) | One call resolves all names to UUIDs and bundles `weight_convention` / `measurement_type` / `default_duration_seconds` — everything `create_program` / `update_program` need. No follow-up `get_exercise_details` required. |
| A muscle group / equipment / difficulty filter ("find chest exercises with dumbbells", "what's a good biceps exercise") and want to BROWSE | `search_exercises` | Returns a filtered list. Once the user picks, optionally batch the chosen names through `resolve_exercises` if you need UUIDs in bulk. |
| A specific name AND the user wants instructions / video / common mistakes ("how do I do a Romanian deadlift") | `resolve_exercises` (1-element batch) → `get_exercise_details(uuid)` | `resolve_exercises` gives you the UUID; `get_exercise_details` returns the full instructions / video / image blob. |
| A UUID already (from any prior tool call) and need full instructions / media | `get_exercise_details` | Direct lookup by UUID. Do NOT call this just to get `weight_convention` — `resolve_exercises` already includes it. |

### Full intent → tool table

| User intent | Tool | Notes |
|---|---|---|
| "Show me my recent workouts / sessions / training history" | `get_workout_history` | Defaults to last 10 sessions. Filter by `from_date` / `to_date` (ISO 8601) or `exercise_name` (fuzzy). Each session header surfaces `*(program: <name>, id: <uuid>)*` for sessions that belong to a cycle — pass that `id` straight to `get_program_details` to chain into the program structure. Sessions without a cycle (legacy data) omit the annotation. |
| "How am I doing / volume / PRs / muscle group balance / push-pull split" | `get_training_stats` | Defaults to last 30 days. Filter by `muscle_group` (FR name, e.g. `Pectoraux`, `Dos`). |
| "What's my next workout / what's programmed for tomorrow" | `get_upcoming_workouts` | Default 3 days, max 7. Exercise lines use `**French name** (English name)` like `get_program_details`. Returns `No active program found` if user has none. The header surfaces `*(id: <uuid>)*` of the active program — pass that `id` straight to `get_program_details` if the user wants the full template instead of the next few scheduled days. |
| "Find / search exercises for X muscle / with Y equipment" | `search_exercises` | FR + EN names. Use for exploration / browsing by filter. For "I already know the name(s) I want to put in a program" prefer `resolve_exercises` (one round-trip, returns everything `create_program` needs). Aliases: `chest`/`pecs` → `Pectoraux`, body regions like `push`/`pull`/`legs`/`core`/`upper_body`/`lower_body` work too. |
| "I have a list of exercise names — give me their catalog ids" / "build a program from this list" | `resolve_exercises` | Batch (up to 30 names per call). Returns id, equipment, `weight_convention`, `measurement_type`, `default_duration_seconds` per query — enough to call `create_program` directly without `get_exercise_details`. Each query gets a status: `matched` / `ambiguous` / `no_match` / `empty_query`. On `ambiguous`, pick from context or ask the user; on `no_match`, fall back to `search_exercises` with broader filters. |
| "Tell me more about exercise X / how to do X" | `get_exercise_details` | Requires a UUID (`exercise_id`). Returns form cues / video / common mistakes. Instructions are **English when a reviewed translation exists**, otherwise French. **Not** needed before `create_program` — `resolve_exercises` already returns what `create_program` needs. |
| "List / browse the user's training programs" | `list_programs` | Returns id, name, is_active, day_count, created_at, has_active_cycle for every non-archived program. Pass `include_archived: true` to see archived ones. Works regardless of cycle state — use to enumerate programs before drilling into one. |
| "Show me the structure of program X / review my draft / what's in this program" | `get_program_details` | Requires a UUID (`program_id`). Returns days with **solos + Circuits** interleaved, plus a fenced ` ```json ` payload (`days` patch shape) for echo into `update_program`. Prefer that JSON over paraphrasing the markdown. Exercise lines use `**French name** (English name)` when `name_en` exists. Works on **any** program — active, draft, or archived. **Always run `list_programs` first**, or use the `program_id` from `get_upcoming_workouts` / `get_workout_history`. |
| "Design / save / replace my program" | `create_program` | Multi-day. **`dry_run` defaults to `true`** — preview first, then re-call with `dry_run: false` to persist. **Deactivates other active programs** — for a single ad-hoc session that should NOT replace the user's active program, use `create_workout_day` instead. Each day's `exercises[]` may mix bare UUIDs, solo prescriptions, and **Circuits** (`type: "circuit"`). |
| "Rename / edit / tweak / swap exercises or Circuits in a program (without losing history)" | `update_program` | In-place edit by `program_id`. **Preserves all logged sessions** — never recreate via `create_program` for an existing program (that orphans history). PATCH at top-level (`name?`, `days?`); inside `days`, declarative full-list with optional `id` per day (id present → UPDATE, id absent → INSERT, **omitted current day → DELETE**). A day's `exercises[]` **fully replaces** that day's solos **and** Circuits. `dry_run: true` by default. Removing days requires `confirm: true` along with `dry_run: false`. Mid-cycle edits surface a French warning. Atomicity is per-day → on failure, response includes `applied_days` / `failed_at` / `remaining_days` + retry guidance. |
| "Quick workout for today / one ad-hoc session / extra workout this week" | `create_workout_day` | **Single ad-hoc day** — does NOT replace or deactivate the user's active program (the headline differentiator vs `create_program`). Persists as a standalone `workout_days` row with `program_id: NULL` and the visual identity emoji `⚡`. **`dry_run` defaults to `true`** — preview first, then re-call with `dry_run: false` to persist. Max **20 day items** per call (a Circuit counts as **one** item). Same `exercises[]` shape as `create_program` (bare UUID, solo object, or Circuit). |

There's also one **MCP resource** (`exercise_catalog_schema`) exposing the muscle-group / equipment / difficulty taxonomy. Read it once at the start of a session if the runtime supports resources, otherwise rely on `search_exercises`'s built-in aliasing.

---

## Discovery flow — read & inspect a program

When the user wants to review, inspect, or talk about *a specific program* (active or not), follow this chain:

1. **`list_programs`** — enumerate the user's programs to identify the right one by name. Each entry surfaces `*(id: <uuid>)*` for downstream addressability.
2. **`get_program_details(program_id)`** — fetch the full structure of the chosen program (days, exercises, sets/reps/weights, rest). Works on **any** program — active, draft, or archived — regardless of cycle state. Use this to answer "review my draft program" / "show me the structure" / "compare these two". Returns markdown with inline `*(id: ...)*` on every day and exercise line, ready for downstream tools.
3. **`update_program(program_id, patch)`** — apply targeted edits to that program by id without recreating it. Use whenever the user wants to *modify* an existing program (rename, swap an exercise, add/remove a day, revise a prescription) — it preserves training history. See the dedicated patterns section below.

For the *active* program with an *active cycle*, `get_upcoming_workouts` is the cheaper alternative when the user wants only the next few days (it returns dated, scheduled instances). Use `get_program_details` instead when the user wants the **whole program template** or the active program has **no cycle started**.

---

## Writes — propose → confirm → act → echo (always, no exceptions)

Every write tool — `create_program`, `update_program`, and any future logging tools — goes through a **four-step handshake**, even when the user gave a direct, unambiguous request.

### Why this is mandatory

Workout payloads pack many fields (exercise UUID + sets + reps + weight + equipment-convention + RPE + date + notes). The well-known **field-drop failure mode** of LLMs is acute on multi-field payloads: the agent paraphrases the user's intent into a tool call, silently drops one field during translation, and the user only catches the bad data hours later in-app. Pre-call confirmation costs 2 seconds; un-doing the wrong write costs a manual fix. This is why `create_program.dry_run` defaults to `true` server-side — the design preview *is* the propose step.

### The four steps

1. **Propose** — Restate the **exact tool name** + the **full payload, every field**. For weight payloads, explicitly name the equipment convention you applied (e.g. *"100 kg total au barbell"* vs *"30 kg per hand sur dumbbells"*).
2. **Confirm** — Wait for explicit `yes` / `ok` / `go` / `vas-y`. Ambiguous response = re-ask, **not** consent. *"Je crois que oui"* is not consent.
3. **Act** — Call the tool.
4. **Echo** — Print the server's response (created ID, canonical fields written) so the user can spot a mismatch immediately.

### Worked example — write with weight ambiguity

User: *"j'ai fait du DB shoulder press, 4×12 à 22.5"*

Agent (propose, with disambiguation): *"22.5 kg c'est par main (= 45 total) ou total réparti sur les deux haltères ? Pour DB shoulder press la convention serveur est par main, je pars là-dessus si tu confirmes."*

User: *"par main oui"*

Agent (refined propose): *"OK, payload : DB Shoulder Press (`<uuid>`), 4 × 12 × 22.5 kg per-hand (45 kg total). Date 2026-05-03. Je log ?"*

User: *"oui"*

Agent: calls the tool, echoes back the created ID + canonical fields.

### What the handshake rules out

- ❌ Auto-applying a write because *"the user clearly meant it"*. Field-fidelity beats convenience.
- ❌ Skipping the echo step. The server may have applied a default the user didn't notice (e.g. `dry_run` left at `true` and nothing actually persisted — see Pattern 4 below).
- ❌ Stitching two propose steps without intermediate consent (e.g. *"I see a calendar event for gym at 7am, I'll pre-create the session and log my best guess"* — no, ask first, then ask again before logging).
- ❌ Re-using a payload the user confirmed 5 turns ago for a *different* tool. Each `act` step needs its own fresh `propose` + `confirm`.

---

## Weight conventions per equipment — READ THIS BEFORE COMPUTING ANY VOLUME

Volume math depends on **equipment type**. The `weight_logged` field on a set log does NOT always represent total load. Get this wrong and your push-pull / leg-arm volume analysis will be off by 2x for half the sets.

| Equipment | What `weight_logged` means | How to compute total volume |
|---|---|---|
| `dumbbell` (unilateral, both hands at once: curls, presses, rows…) | **Per hand** | `total_load = weight_logged * 2` then `volume = total_load * reps` |
| `kettlebell` (single-hand) | **Per hand** | Same: multiply by 2 if both hands working in alternation, else use as-is for single-hand sets |
| `barbell` | Total bar load | Use `weight_logged` directly |
| `machine` (stack-loaded) | Stack value (total) | Use `weight_logged` directly |
| `plate-loaded machine` (Hammer Strength etc.) | Total plate load | Use `weight_logged` directly |
| `cable` / poulie | Stack value (total) | Use `weight_logged` directly |
| `ez_bar` | Total bar load | Use `weight_logged` directly |
| `bodyweight` | `0` | Exclude from volume; still count the set |

### How to know which equipment

- `get_exercise_details` returns `equipment` explicitly — it is the source of truth. **Since v0.3.0** it also returns a derived `**Weight convention:** {per_hand|total|bodyweight}` line right next to it, so you don't have to remember the equipment-to-convention mapping yourself.
- Exercise names hint: "Curl haltères" / "Dumbbell Curl" → `dumbbell` (per hand). "Développé couché" / "Bench Press" → `barbell` (total). But hints are **not** authoritative — *"Bulgarian Split Squat"* might be DB or BB depending on the user's setup, and *"Front Squat"* vs *"Goblet Squat"* are the same English word "squat" with opposite conventions.
- **Operational rule**: if equipment is ambiguous AND the user is asking for a numeric volume / load summary / progression analysis, **call `get_exercise_details` first** (one extra tool call beats a wrong number). Don't guess from the name when a number is on the line.
- When you cannot resolve equipment (lookup failed, exercise not in catalog), **state the assumption verbatim** and offer to re-run if the user corrects you. Don't pick a side and hope.

### Read AND write side use the same convention

The `weight_convention` exposed by `get_exercise_details` is the same convention that the write tools (`create_program`, `update_program`) interpret when you send `weight_kg`. So if you read `Weight convention: per_hand` on a dumbbell exercise and the user says *"40 kg"*, send `weight_kg: 40` (per hand) — the tool will not silently double it. **When in doubt before a write, call `get_exercise_details` first** to confirm the convention you're committing to.

### Failure mode to avoid

A morning brief that says *"belle séance hier, 2400 kg de volume sur les épaules"* when half the exos were dumbbells and you treated `weight_logged` as total → you've doubled or halved silently and the user has no way to spot it. The first time this comes up live, **ask the user what definition of "volume" they want** (sum of total loads × reps × sets? per-side?), persist it, apply consistently across the rest of the conversation.

### Worked example

User logs 4 sets of 10 reps at `25 kg` for "Curl haltères" (dumbbell):

- ❌ Naive: `volume = 4 * 10 * 25 = 1000 kg`
- ✅ Correct: `25 kg per hand × 2 hands × 10 reps × 4 sets = 2000 kg`

When you report volume, **always say which interpretation you used** ("Volume bilatéral, haltères comptés à deux mains") so the user can call out a mistake.

---

## Conversation patterns

### Pattern 1 — Recent training summary

User: *"Qu'est-ce que j'ai fait cette semaine ?"*

```jsonc
get_workout_history({ from_date: "<monday-iso>", to_date: "<today-iso>" })
```

Then summarize: session count, top exercises, total tonnage (with the weight-convention caveat above).

### Pattern 2 — Volume balance over a month

User: *"How's my push/pull balance?"*

```jsonc
get_training_stats({ days: 30 })
```

Read the per-muscle-group volume. Group `Pectoraux + Épaules + Triceps` as push, `Dos + Biceps + Trapèzes + Deltoïdes post.` as pull, and tell the user the ratio.

### Pattern 3 — Exercise lookup → details

User: *"How do I do a Romanian deadlift?"*

```jsonc
// 1. Resolve the name to a UUID + metadata (1-element batch is fine)
resolve_exercises({ queries: ["romanian deadlift"] })
// → { results: [{ status: "matched", matches: [{ id: "<uuid>", weight_convention: "total", ... }] }] }

// 2. Pull full instructions / video / image for that UUID
get_exercise_details({ exercise_id: "<uuid>" })
```

For ambiguous names (`status: "ambiguous"`), present the alternates from `matches` to the user before calling `get_exercise_details`. For `status: "no_match"`, fall back to `search_exercises` with broader filters or ask the user to rephrase.

### Pattern 4 — Design + persist a new program

User: *"Propose-moi un 4 jours full-body et active-le."*

1. Read context: `get_training_stats`, optionally `get_upcoming_workouts` to see the current program.
2. Resolve every exercise name to a UUID in **one call** with `resolve_exercises({ queries: [...] })` (since v0.5.0). The response includes `weight_convention`, `measurement_type`, and `default_duration_seconds` per exercise — no follow-up `get_exercise_details` calls needed before `create_program`. For any entry with `status: "ambiguous"`, present alternates to the user; for `status: "no_match"`, retry with a broader name or ask the user.
3. Dry-run preview using either bare UUIDs (server defaults) or full prescription objects (frozen progression — see "Common write patterns" below):

```jsonc
create_program({
  name: "Full Body 4d",
  days: [
    {
      label: "Lundi — Lower",
      exercises: [
        // Bare UUID → defaults (3 × 10, 0 kg, 90s rest, auto-derived ranges)
        "<uuid-bench>",
        // Object form → explicit prescription, ranges frozen, weight stored
        { exercise_id: "<uuid-squat>", sets: 4, reps: "8", weight_kg: 100, rest_seconds: 180 }
      ]
    },
    { label: "Mardi — Upper push", exercises: [...] },
    { label: "Jeudi — Lower", exercises: [...] },
    { label: "Vendredi — Upper pull", exercises: [...] }
  ],
  dry_run: true
})
```

4. Read the preview's `days[].rendered` lines back to the user (e.g. *"Squat — 4 × 8 × 100 kg total — 180s rest"*) and get explicit consent.
5. Apply: same call with `dry_run: false`. Confirm: *"Program created and set active."*

**Server defaults (bare UUID form)**: 3 sets × 10 reps × 90s rest, weight 0 (or duration mode for time-based exercises). The user can fine-tune in-app afterwards.

### Pattern 5 — Quick ad-hoc workout (single session, leaves active program intact)

User: *"crée-moi un quick workout pecs / triceps pour aujourd'hui, 4 exos"* / *"give me a quick chest+triceps session for today"*

**Use `create_workout_day` — never `create_program`.** `create_program` would deactivate the user's running plan; `create_workout_day` adds an unattached `workout_days` row (`program_id: NULL`) and leaves their active program exactly as it was. The user keeps tomorrow's programmed session AND gets today's extra workout.

1. (Optional) Read context: `get_training_stats` to spot weak points, `get_upcoming_workouts` to avoid clashing with what's programmed for today.
2. Resolve exercise names in **one call**: `resolve_exercises({ queries: [...] })`. Same flow as Pattern 4 — the response carries `weight_convention` / `measurement_type` per match.
3. Dry-run preview:

```jsonc
create_workout_day({
  label: "Quick Push Day",   // 1..100 chars; shown in-app as the day's title
  exercises: [
    // Bare UUID → defaults (3 × 10, 0 kg, 90s rest)
    "<uuid-bench>",
    // Object form → explicit prescription (same shape as create_program)
    { exercise_id: "<uuid-incline-db>", sets: 3, reps: "10", weight_kg: 22.5, rest_seconds: 90 },
    { exercise_id: "<uuid-tri-pushdown>", sets: 4, reps: "12", weight_kg: 25, rest_seconds: 60 },
    "<uuid-pushup>"           // bodyweight; weight_kg defaults to 0
  ],
  dry_run: true
})
// → { dry_run: true, workout_day: { label, emoji: "⚡", sort_order: 0, program_id: null,
//      workout_exercises: [...], rendered: ["Bench Press — 3 × 10 × 0 kg total — 90s rest", ...] } }
```

4. Echo the `rendered` lines back to the user, get explicit consent. The propose-confirm-act handshake applies here too — agents that auto-write a Quick Workout will silently field-drop on long lists just like with `create_program`.
5. Apply: same call with `dry_run: false`. Server returns `{ workout_day_id: <uuid>, exercises_count: <n> }`. The user's active program **stays active** — confirm this in your echo: *"Séance Quick Push créée. Ton programme actif reste inchangé."*

**Limits**: max 20 exercises per call. Same input shape as `create_program`'s per-day `exercises` array (mix bare UUIDs and prescription objects freely). The server hardcodes `emoji: "⚡"` for visual identity in the app — agents do NOT pass `emoji`.

**When to reach for `create_program` instead**: the user wants a *recurring* split (e.g. *"un programme push/pull/legs"*) — that's a multi-day plan with `program_id`, weekly cadence, and active-cycle semantics. Quick Workout is for one-off sessions only.

### Circuits (`type: "circuit"`)

A **Circuit** is one day item that groups 2–8 nested exercises across rounds (superset, triset, finisher, conditioning complex). Always say **Circuit** in user-facing copy — never "block".

**Wire shape** (hybrid — flat for the common case, `per_round` for pyramids):

```jsonc
{
  type: "circuit",
  label: "Finisher",          // optional
  rounds: 3,                  // default 3; bounds [1, 10]
  rest_seconds: 90,           // rest between rounds; default 90
  transition_seconds: 0,      // rest between exercises inside a round; default 0
  exercises: [
    // Flat — same amount/weight every round (server expands to all rounds)
    { exercise_id: "<uuid-burpee>", amount: 10, weight_kg: 0 },
    { exercise_id: "<uuid-kb-swing>", amount: 12, weight_kg: 16 },
    // Pyramid — per-round cells (length MUST equal `rounds`)
    // { exercise_id: "<uuid-burpee>", per_round: [
    //   { amount: 20, weight_kg: 0 }, { amount: 15, weight_kg: 0 }, { amount: 10, weight_kg: 0 }
    // ] }
  ]
}
```

Nested exercises use **`amount` + `weight_kg`** (or `per_round`) — **never** solo fields (`sets`, `reps`, per-exercise `rest_seconds`). Flat + `per_round` together → reject. A Circuit counts as **one** slot toward the day cap (40 on `create_program`, 20 on `create_workout_day`).

**Tours vs AMRAP:** omit `mode` (or send `"rounds"`) → **Tours** (N rounds, defaults 3 / 90s rest / 0s transition). CrossFit-style WODs that stop on a clock (Cindy, Helen, “as many rounds as possible”) use `mode: "amrap"` + `cap_minutes` (1–60, default 20). AMRAP + `rounds` / `rest_seconds` / `transition_seconds` / nested `per_round` is a **hard reject** — do not send those fields. dry_run / details echo `AMRAP 20 min` plus the gloss *As many rounds as possible.* — never the naked acronym.

**Named WODs** are catalog **Benchmark Circuits**. Persist with `benchmark_slug` — do **not** reconstruct an Rx as identity. Catalog Rx wins. Supported slugs are `cindy`, `zeus`, `heracles`, `ares`, `theseus`, `athena`, `atlas`, `hades`, and `achilles`. Unknown slug → **error**, no insert. Generic Circuits omit `benchmark_slug`.

```jsonc
{
  type: "circuit",
  benchmark_slug: "cindy"
}
```

For Zeus, send the catalog identity directly:

```jsonc
{
  type: "circuit",
  benchmark_slug: "zeus"
}
```

Do not reconstruct Zeus's burpees, jump squats, and push-ups as its identity; the catalog prescription is authoritative. Label coerce exists for Cindy (`Cindy` / `Holland` / `tom holland` → `cindy`), but agents should still send the slug. Quick Workout's closed-intent coerce remains Cindy-only; extending it to Pantheon names is out of scope for [#480](https://github.com/PierreTsia/workout-app/issues/480), not a bug.

**Generic AMRAP** (not a catalog seed — omit slug, send mode + nested Rx):

```jsonc
{
  type: "circuit",
  label: "Conditioning",
  mode: "amrap",
  cap_minutes: 12,
  exercises: [
    { exercise_id: "<uuid-burpee>", amount: 10, weight_kg: 0 },
    { exercise_id: "<uuid-kb-swing>", amount: 15, weight_kg: 16 }
  ]
}
```

**When to propose a Circuit** (External MCP / Additional program — be proactive when it fits):

- User asks for a circuit / superset / triset / finisher / conditioning complex
- Classic agonist–antagonist pairings run back-to-back
- Short metabolic finishers after strength work
- Same exercise twice in one complex (allowed — distinct nested slots)

**Be conservative on first-program onboarding**: prefer Circuits only on explicit ask or an obvious conditioning finisher — don't overload a beginner strength template with supersets.

**Progression**: Circuit nested prescriptions are **frozen** (no auto progression on nested `amount` / `weight_kg`). Mention this once when you introduce a Circuit; don't lecture every turn. Solo exercises next to the Circuit keep normal progression.

**Round-trip / edit rule**: for `update_program`, start from the **` ```json ` fence** in `get_program_details` (patch-shaped `days`), not from the markdown alone — otherwise pyramids / transition can drift. A patched day's `exercises[]` replaces that day's entire Unified Day Sequence (solos + Circuits).

**History / upcoming**: `get_upcoming_workouts` and `get_workout_history` render Circuits (history is round-major). Don't flatten a Circuit into fake solo sets when summarizing.

### Common write patterns (v0.3.0+ object form)

These are the three patterns that cover ~95% of strength prescriptions. Pick the one that matches the user's intent — don't mix `target_duration_seconds` with reps-mode exercises (the server will reject it).

**Linear progression** — fixed reps target, weight bumps when target is hit:

```jsonc
{
  exercise_id: "<uuid-bench>",
  sets: 4,
  reps: "8",          // frozen: rep_range_min === rep_range_max === 8
  weight_kg: 80,      // total bar load (barbell convention)
  rest_seconds: 120
}
```

**Double progression** — rep range; reps grow first, then weight bumps and reps reset to bottom of range:

```jsonc
{
  exercise_id: "<uuid-curl>",
  sets: 4,
  reps: "8-12",       // frozen: rep_range_min === 8, rep_range_max === 12
  weight_kg: 15,      // PER HAND for dumbbells (check via get_exercise_details)
  rest_seconds: 90
}
```

**Fractional weight** (microloading, dumbbell increments): pass any number, it lands verbatim in the DB.

```jsonc
{
  exercise_id: "<uuid-db-curl>",
  sets: 3,
  reps: "10",
  weight_kg: 22.5,    // stored as TEXT; the app handles the kg/lb display
  rest_seconds: 60
}
```

**Bodyweight prescription** — pass `weight_kg: 0` (server rejects > 0 with a pointer to issue #281). Explicit ranges are accepted but silently ignored: the persistence layer ALWAYS auto-derives bodyweight ranges, so double progression on dips/pull-ups *just works* without you doing range math.

```jsonc
{
  exercise_id: "<uuid-pullup>",
  sets: 4,
  reps: "8",          // hint for the auto-derived range (server stores 6-10)
  weight_kg: 0,       // MUST be 0 for bodyweight in v0.3.0
  rest_seconds: 90
}
```

**Duration prescription** (planks, holds, hangs) — pass `reps: "0"`, `weight_kg: 0`, and `target_duration_seconds` (5-600). The server freezes `duration_range_min/max_seconds` to the prescribed value (no spread):

```jsonc
{
  exercise_id: "<uuid-plank>",
  sets: 4,
  reps: "0",                    // MUST be "0" for duration mode
  weight_kg: 0,                 // MUST be 0 (weighted duration not modelled in v0.3.0)
  rest_seconds: 60,
  target_duration_seconds: 30   // REQUIRED on duration object form (or use bare UUID for catalog default)
}
```

**Mixed reps + duration day** — totally fine, the array can interleave both modes:

```jsonc
{
  label: "Core Finisher",
  exercises: [
    { exercise_id: "<uuid-plank>",  sets: 3, reps: "0",  weight_kg: 0,  rest_seconds: 45, target_duration_seconds: 45 },
    { exercise_id: "<uuid-leg-raise>", sets: 3, reps: "12", weight_kg: 0, rest_seconds: 60 },
    "<uuid-side-plank>"   // bare UUID → catalog defaults (duration with default target)
  ]
}
```

### Common write patterns — `update_program` (in-place edits, v0.4.0+)

Use `update_program` whenever the user wants to **modify** an existing program — rename, add / remove / reorder days, swap exercises, revise prescriptions. Reach for it **first** for any edit intent on a program that already exists. `create_program` on top of an existing program **orphans** every logged session that pointed at the old day rows.

**The two non-obvious rules** (these trip every agent on the first try):

1. **Inside `days[]`, the array is declarative — not a partial patch.** A day with `id` matching a current day is an UPDATE; without `id` is an INSERT; **a current day NOT in `days[]` is a DELETE**. So if the user wants to edit one day, you echo *every* current day, modifying only the affected one.
2. **`days` is itself optional.** Omit the field entirely if you only want to rename. Pass `name` only → no day touched, no destructive guard, single PATCH.

Always `dry_run: true` first. The preview returns:
- `rendered`: human-readable markdown of the program *as it will be after apply*
- `removed_days[]`: every day that would be deleted (with `session_count` and `blocking` flag)
- `added_days[]`: every new day that would be inserted
- `warnings[]`: includes the active-cycle warning (`"Cycle actif depuis YYYY-MM-DD — ..."`) when applicable
- `errors[]`: validation / apply failures (empty when the patch is well-formed)

**Discovery prerequisite for any non-rename edit**: `list_programs` → `get_program_details(program_id)` to read every current day's `id`, label, and exercise prescription. The `*(exercise_id: <uuid>)*` annotation on every exercise line in `get_program_details` (since v0.4.0) is the catalog id you reuse in your patch — not the row's slot id.

**Worked example 1 — rename only** (no day touched):

> Prompt: *"renomme mon programme PPL en 'PPL v2'"*

```jsonc
// Step 1 — find the program id
list_programs({})
// → entry: PPL *(id: <pid>)*

// Step 2 — preview (always)
update_program({
  program_id: "<pid>",
  name: "PPL v2"
  // dry_run defaults to true → no writes; agent reads `rendered` back to user
})

// Step 3 — apply once user confirms
update_program({
  program_id: "<pid>",
  name: "PPL v2",
  dry_run: false
})
// → { applied_days: [], failed_at: null, message: "Updated 0 day(s)." }
```

**Worked example 2 — add a day** (echo every current day, append the new one):

> Prompt: *"ajoute une journée Cardio à mon programme PPL avec 3 exos: course 4×30s, jump rope 4×60s, plank 4×45s"*

```jsonc
// Step 1 — id resolution
list_programs({})
get_program_details({ program_id: "<pid>" })   // ← read every day id + every exercise_id

// Step 2 — resolve all the new exercise names in ONE call
resolve_exercises({ queries: ["running", "jump rope", "plank"] })
// → { results: [
//     { query: "running",   status: "matched", matches: [{ id: "<uuid-run>",   measurement_type: "duration", default_duration_seconds: 30, ... }] },
//     { query: "jump rope", status: "matched", matches: [{ id: "<uuid-jump>",  measurement_type: "duration", default_duration_seconds: 60, ... }] },
//     { query: "plank",     status: "matched", matches: [{ id: "<uuid-plank>", measurement_type: "duration", default_duration_seconds: 45, ... }] },
//   ] }

// Step 3 — preview the patch
update_program({
  program_id: "<pid>",
  days: [
    // Echo each current day with its id → UPDATE-but-leave-as-is. Bare UUIDs
    // for unchanged exercises keep the payload concise.
    { id: "<push-day-id>", label: "Push", emoji: "💪", exercises: ["<bench-uuid>", "<incline-uuid>"] },
    { id: "<pull-day-id>", label: "Pull", emoji: "🪝", exercises: ["<row-uuid>", "<curl-uuid>"] },
    { id: "<legs-day-id>", label: "Legs", emoji: "🦵", exercises: ["<squat-uuid>", "<rdl-uuid>"] },
    // New day — no `id` → INSERT. Duration exercises need full object form.
    {
      label: "Cardio",
      emoji: "🏃",
      exercises: [
        { exercise_id: "<uuid-run>",   sets: 4, reps: "0", weight_kg: 0, rest_seconds: 60, target_duration_seconds: 30 },
        { exercise_id: "<uuid-jump>",  sets: 4, reps: "0", weight_kg: 0, rest_seconds: 60, target_duration_seconds: 60 },
        { exercise_id: "<uuid-plank>", sets: 4, reps: "0", weight_kg: 0, rest_seconds: 60, target_duration_seconds: 45 }
      ]
    }
  ]
  // dry_run defaults to true
})
// → preview shows added_days: [{ label: "Cardio" }], removed_days: []. Echo to user.

// Step 4 — apply with dry_run: false after explicit consent.
```

**Worked example 3 — swap an exercise + revise prescription** (preserves history):

> Prompt: *"remplace RDL par soulevé de terre conventionnel et passe le bench à 4×8 @ 80kg"*

The agent must **include every current day** in `days[]` — the array is declarative, omitting Legs (or any day) deletes it.

```jsonc
list_programs({})
get_program_details({ program_id: "<pid>" })   // read every day id + current prescriptions
resolve_exercises({ queries: ["conventional deadlift"] })  // → <uuid-conv-dl> + weight_convention

update_program({
  program_id: "<pid>",
  days: [
    {
      id: "<push-day-id>",
      label: "Push",
      emoji: "💪",
      exercises: [
        "<warmup-uuid>",                                                 // unchanged → bare UUID
        { exercise_id: "<bench-uuid>", sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120 },  // revised
        "<accessory-uuid>"                                               // unchanged
      ]
    },
    {
      id: "<pull-day-id>",
      label: "Pull",
      emoji: "🪝",
      exercises: [
        // RDL swapped out → conventional deadlift in. Object form because
        // we're prescribing weight + rep range explicitly.
        { exercise_id: "<uuid-conv-dl>", sets: 3, reps: "5", weight_kg: 100, rest_seconds: 180 },
        "<other-pull-uuid>"
      ]
    },
    // Legs unchanged but MUST be echoed (omitting it = DELETE).
    { id: "<legs-day-id>", label: "Legs", emoji: "🦵", exercises: ["<squat-uuid>", "<leg-press-uuid>"] }
  ],
  dry_run: true
})
// Echo `rendered` back: "Bench Press — 4 × 8 × 80 kg total — 120s rest", etc.
// Apply with dry_run: false on consent.
```

**Destructive edits** (removing days):

When the dry_run preview's `removed_days[]` is non-empty, applying needs **both** `dry_run: false` AND `confirm: true`. Without `confirm`, the server returns: *"Patch removes N day(s): … Pass `confirm: true` along with `dry_run: false` to apply, or revise the payload to keep these days."*

Removing a day with logged sessions is allowed. Those sessions are **detached** from the template (`sessions.workout_day_id` SET NULL) — history stays (label snapshot + set logs). `removed_days[].session_count` tells you how many sessions will be detached; `blocking` stays `false`. `confirm: true` is still required.

**Mid-cycle awareness**:

If the program has an unfinished cycle, both dry_run and apply responses include a French warning string in `warnings[]`: *"Cycle actif depuis YYYY-MM-DD — cette modification affecte vos workouts restants dans ce cycle."* Surface this verbatim to the user in your propose step so they can opt out before confirming.

**Partial-success on apply failure**:

`update_program` is **per-day atomic** — there's no cross-day rollback. If a mid-flight day fails to write, the response is `isError: true` and contains `applied_days` (what landed), `failed_at: { day_label, error }`, `remaining_days[]`, and a `message` ending with verbatim retry guidance. **Show it to the user as-is** and let them resubmit a patch covering only `remaining_days`.

**Activation / `is_active`**:

`update_program` rejects `is_active` in the patch with a pointer: *"Use the dedicated `set_active_program` tool (coming soon)."* Until that tool ships, activation/deactivation happens in-app.

---

## Edge cases

| Situation | What to do |
|---|---|
| `No workout sessions found for this period.` | Tell the user; don't fabricate data. Suggest they log a session in the app first. |
| `No active program found.` (from `get_upcoming_workouts`) | Tell the user, offer to design one with `create_program`. |
| `No active training cycle for "X".` | A program exists but no cycle is started. Tell the user to start a cycle in-app. |
| `search_exercises` returns multiple matches | When BROWSING, list them and ask the user. **For program-building flows, prefer `resolve_exercises` — it returns alternates with `status: "ambiguous"` so you can disambiguate without a second call.** |
| `resolve_exercises` returns `status: "ambiguous"` | Top-2 scores are within the threshold (≈0.10). Look at `matches[]` for alternates, pick from context if obvious (equipment / muscle group hint), otherwise present the list to the user. |
| `resolve_exercises` returns `status: "no_match"` | Nothing similar enough in the catalog. Try `search_exercises` with broader filters (muscle group + equipment), or ask the user to rephrase / pick from a browse list. |
| `resolve_exercises` returns `status: "empty_query"` | One of the input strings was blank/whitespace. Filter empty strings out of `queries` before calling. |
| `Invalid UUID at days["<label>"].exercises[<i>]` | You passed a non-UUID string (e.g. an exercise name). Resolve via `resolve_exercises` (preferred) or `search_exercises` first. |
| `Unknown or inaccessible exercise_id(s):` | The UUID is valid format but the exercise doesn't exist or isn't visible to this user. Re-search. |
| `create_program v0.3.0 introduced a breaking change...` | You used the v0.2.x `exercise_ids` field. Switch to `exercises` (bare UUIDs or full objects — see "Common write patterns"). |
| `reps exercise "X" cannot have target_duration_seconds` | You set `target_duration_seconds` on a reps-mode exercise. Drop it (use reps + weight_kg instead). Duration exercises (planks, holds) get T75 support. |
| `Authentication required` / `401` | Auth expired or revoked. **Default fix — OAuth (most users):** ask the user to refresh the connection from their client's connectors UI (e.g. *Settings → Connectors → gymlogic → Disconnect, then reconnect*) to trigger a fresh OAuth flow. **Only if the user is explicitly on PAT auth** (token starts with `glp_`, set up manually): tell them the token is expired or revoked and to mint a fresh one at `/account/api-tokens`. When in doubt, recommend the OAuth refresh first — it's the right answer in the vast majority of cases. |
| Ambiguous muscle group (`"chest"` vs `"Pectoraux"`) | `search_exercises` accepts both — pass the user's term as-is. For `get_training_stats` the filter must be the FR name (`Pectoraux`). |
| User asks to *modify* one day, swap an exercise, or rename an existing program | Use `update_program` (NEVER `create_program` — that would orphan training history). Pull the current structure with `list_programs` → `get_program_details` first to read every day's `id` and exercise prescription, then send a patch that **echoes every current day** (modifying the affected ones; omitting any day = DELETE). Always `dry_run: true` first. |
| User wants a one-off / extra session today without touching their active program ("quick workout maintenant", "an extra workout for today") | Use `create_workout_day` (NEVER `create_program` — that would deactivate the active program). Single day, max 20 exercises, `program_id: NULL`. See Pattern 5. |

---

## Parameter format conventions

- **Dates**: ISO 8601, date-only (`2026-04-27`) for `from_date` / `to_date`. Server appends `T00:00:00Z` / `T23:59:59Z` automatically.
- **Exercise IDs**: UUID v4 (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`). Always obtained from `resolve_exercises` (preferred for batch program-building) or `search_exercises`. Never invent or transcribe from memory.
- **Muscle groups (FR canonical)**: `Abdos`, `Biceps`, `Deltoïdes post.`, `Dos`, `Épaules`, `Fessiers`, `Ischios`, `Ischios / Bas du dos`, `Lombaires`, `Mollets`, `Pectoraux`, `Quadriceps`, `Trapèzes`, `Triceps`.
- **Equipment values**: `barbell`, `dumbbell`, `cable`, `machine`, `ez_bar`, `bodyweight`.
- **Body region aliases** (for `search_exercises` only): `upper_body`, `lower_body`, `push`, `pull`, `arms`, `legs`, `core`.
- **Difficulty**: `beginner`, `intermediate`, `advanced`.
- **`create_program` limits**: max **14 days**, max **40 exercises per day**.
- **`create_program.dry_run`**: defaults to `true`. **Always preview first.** Only set `false` after explicit user consent. The apply path deactivates other active programs and sets the new one active — there is no undo in-app beyond reverting via another `create_program` call.
- **`create_workout_day` limits**: `label` 1..100 chars, max **20 exercises** per call. `emoji` is server-controlled (always `⚡`); do not pass it. `dry_run` defaults to `true` — preview first, apply on consent. The apply path adds a single standalone `workout_days` row and **never touches the user's active program**.

---

## References

- Per-client setup guides: [Cursor](../../docs/mcp-connect/cursor.md), [Le Chat](../../docs/mcp-connect/le-chat.md), [Claude Desktop](../../docs/mcp-connect/claude-desktop.md), [OpenClaw](../../docs/mcp-connect/openclaw.md)
- Project README: [README.md](../../README.md)
- Issue [#261](https://github.com/PierreTsia/workout-app/issues/261) (this skill), [#263](https://github.com/PierreTsia/workout-app/issues/263) (per-side weight ambiguity), [#259](https://github.com/PierreTsia/workout-app/issues/259) (PAT epic).
