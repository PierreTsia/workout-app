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

This skill teaches an LLM how to be a competent training coach on top of the [GymLogic](https://gymlogic.me) MCP server. It covers when to invoke each of the **six tools**, how to format their parameters, and the non-obvious quirks that bite zero-shot agents — most importantly the **per-side weight convention for unilateral equipment** (issue [#263](https://github.com/PierreTsia/workout-app/issues/263)).

GymLogic is a French/English workout tracker. The user logs sessions, weights, reps; you read this data and either analyze it or design a new program with `create_program`.

---

## When to invoke this skill

Trigger on any sport / training / fitness intent, in **French or English**:

- "C'est quoi mon prochain training ?", "Montre mes 5 dernières séances", "Mon volume push/pull du mois ?"
- "What did I train this week?", "Search for chest exercises with dumbbells", "How's my training volume?"
- "Donne-moi un programme 4 jours full body" → design + `create_program`
- "Remplace mon programme actuel par X" → `create_program` (replaces active program)
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
https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp
```

All six tools 401 if no auth context. The tool response will be `Authentication required — please provide a valid Bearer token.` — surface that to the user and ask them to (re)connect.

---

## Tool reference (intent → tool)

Six tools total — five reads, one write.

| User intent | Tool | Notes |
|---|---|---|
| "Show me my recent workouts / sessions / training history" | `get_workout_history` | Defaults to last 10 sessions. Filter by `from_date` / `to_date` (ISO 8601) or `exercise_name` (fuzzy). |
| "How am I doing / volume / PRs / muscle group balance / push-pull split" | `get_training_stats` | Defaults to last 30 days. Filter by `muscle_group` (FR name, e.g. `Pectoraux`, `Dos`). |
| "What's my next workout / what's programmed for tomorrow" | `get_upcoming_workouts` | Default 3 days, max 7. Returns `No active program found` if user has none. |
| "Find / search exercises for X muscle / with Y equipment" | `search_exercises` | FR + EN names. Use **before** `get_exercise_details` to resolve a UUID. Aliases: `chest`/`pecs` → `Pectoraux`, body regions like `push`/`pull`/`legs`/`core`/`upper_body`/`lower_body` work too. |
| "Tell me more about exercise X / how to do X" | `get_exercise_details` | Requires a UUID (`exercise_id`). **Always run `search_exercises` first** to resolve it; if multiple matches come back, ask the user to pick. |
| "Design / save / replace my program" | `create_program` | Multi-day. **`dry_run` defaults to `true`** — preview first, then re-call with `dry_run: false` to persist. Deactivates other active programs. |

There's also one **MCP resource** (`exercise_catalog_schema`) exposing the muscle-group / equipment / difficulty taxonomy. Read it once at the start of a session if the runtime supports resources, otherwise rely on `search_exercises`'s built-in aliasing.

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

- `get_exercise_details` returns `equipment` explicitly — call it whenever you're not sure.
- Exercise names hint: "Curl haltères" / "Dumbbell Curl" → `dumbbell` (per hand). "Développé couché" / "Bench Press" → `barbell` (total).
- When in doubt, lean conservative and tell the user the assumption you made.

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
// 1. Find it
search_exercises({ query: "romanian deadlift" })
// → returns { id: "<uuid>", ... } if single match, list otherwise

// 2. Pull full details (only on single match — otherwise ask user to pick)
get_exercise_details({ exercise_id: "<uuid>" })
```

### Pattern 4 — Design + persist a new program

User: *"Propose-moi un 4 jours full-body et active-le."*

1. Read context: `get_training_stats`, optionally `get_upcoming_workouts` to see the current program.
2. Search exercises to resolve UUIDs (one `search_exercises` call per movement, narrow to single matches).
3. Dry-run preview:

```jsonc
create_program({
  name: "Full Body 4d",
  days: [
    { label: "Lundi — Lower", exercise_ids: ["<uuid>", "<uuid>", ...] },
    { label: "Mardi — Upper push", exercise_ids: [...] },
    { label: "Jeudi — Lower", exercise_ids: [...] },
    { label: "Vendredi — Upper pull", exercise_ids: [...] }
  ],
  dry_run: true
})
```

4. Show the preview to the user, get explicit consent.
5. Apply: same call with `dry_run: false`. Confirm: *"Program created and set active."*

**Defaults applied by the server**: 3 sets × 10 reps × 90s rest per exercise (or duration mode for time-based exercises). The user can fine-tune in-app afterwards.

---

## Edge cases

| Situation | What to do |
|---|---|
| `No workout sessions found for this period.` | Tell the user; don't fabricate data. Suggest they log a session in the app first. |
| `No active program found.` (from `get_upcoming_workouts`) | Tell the user, offer to design one with `create_program`. |
| `No active training cycle for "X".` | A program exists but no cycle is started. Tell the user to start a cycle in-app. |
| `search_exercises` returns multiple matches | **Do not pick blindly.** List them and ask the user. Only call `get_exercise_details` once a single match is selected. |
| `Invalid UUID(s) in days[i].exercise_ids` | You passed a non-UUID string (e.g. an exercise name). Resolve via `search_exercises` first. |
| `Unknown or inaccessible exercise_id(s):` | The UUID is valid format but the exercise doesn't exist or isn't visible to this user. Re-search. |
| `Authentication required` / `401` | Token expired or revoked. Tell the user to create a fresh PAT at `/account/api-tokens`. |
| Ambiguous muscle group (`"chest"` vs `"Pectoraux"`) | `search_exercises` accepts both — pass the user's term as-is. For `get_training_stats` the filter must be the FR name (`Pectoraux`). |
| User asks to *modify* one day of an existing program | Out of scope for MCP — `create_program` replaces the whole program. Tell the user single-day tweaks happen in-app (Workout Builder). |

---

## Parameter format conventions

- **Dates**: ISO 8601, date-only (`2026-04-27`) for `from_date` / `to_date`. Server appends `T00:00:00Z` / `T23:59:59Z` automatically.
- **Exercise IDs**: UUID v4 (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`). Always obtained from `search_exercises`. Never invent or transcribe from memory.
- **Muscle groups (FR canonical)**: `Abdos`, `Biceps`, `Deltoïdes post.`, `Dos`, `Épaules`, `Fessiers`, `Ischios`, `Ischios / Bas du dos`, `Lombaires`, `Mollets`, `Pectoraux`, `Quadriceps`, `Trapèzes`, `Triceps`.
- **Equipment values**: `barbell`, `dumbbell`, `cable`, `machine`, `ez_bar`, `bodyweight`.
- **Body region aliases** (for `search_exercises` only): `upper_body`, `lower_body`, `push`, `pull`, `arms`, `legs`, `core`.
- **Difficulty**: `beginner`, `intermediate`, `advanced`.
- **`create_program` limits**: max **14 days**, max **40 exercises per day**.
- **`create_program.dry_run`**: defaults to `true`. **Always preview first.** Only set `false` after explicit user consent. The apply path deactivates other active programs and sets the new one active — there is no undo in-app beyond reverting via another `create_program` call.

---

## References

- Per-client setup guides: [Cursor](../../docs/mcp-connect/cursor.md), [Le Chat](../../docs/mcp-connect/le-chat.md), [Claude Desktop](../../docs/mcp-connect/claude-desktop.md), [OpenClaw](../../docs/mcp-connect/openclaw.md)
- Project README: [README.md](../../README.md)
- Issue [#261](https://github.com/PierreTsia/workout-app/issues/261) (this skill), [#263](https://github.com/PierreTsia/workout-app/issues/263) (per-side weight ambiguity), [#259](https://github.com/PierreTsia/workout-app/issues/259) (PAT epic).
