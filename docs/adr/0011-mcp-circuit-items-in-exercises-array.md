# ADR 0011 — MCP Circuits via additive `exercises[]` Circuit Items

- **Status:** Accepted
- **Date:** 2026-08-04
- **Decided in:** grilling session (`grill-with-docs`) for issue [#452](https://github.com/PierreTsia/workout-app/issues/452)

## Context

ADR 0007 shipped rich **Exercise Blocks** in-app but explicitly deferred MCP and AI generation: `create_program` / `create_workout_day` (and Embedded Agent / Quick Workout) must not produce blocks in v1. That deferral is now the gap. Agents connected as an **External MCP Client** still speak only flat solo `exercises[]`, and read tools omit Circuits entirely — so `get_program_details` lies about days that contain blocks, and any `update_program` wipe-and-reinsert of `workout_exercises` alone would leave orphan blocks or silently drop them.

Forces:

1. **Public MCP contract** — additive change preferred; solo-only payloads must keep working.
2. **Unified Day Sequence** — a day is an ordered list of solos *and* Circuits; a sibling `circuits[]` field or a separate `create_circuit` tool fights that model and breaks atomic dry_run of a mixed day.
3. **LLM fragility** — full per-round grids are easy to mis-align; silent coerce of solo fields (`sets`, `reps: "8-12"`) into block cells teaches the wrong mental model (Circuits are outside the progression engine).
4. **Product parity** — Claude-on-MCP and in-app Program AI should both create Circuits when appropriate; Quick Workout AI is still `{ exerciseIds[] }` today and needs a heavier reshape.

## Decision

We will expose Circuits on MCP as an additive third variant in each day's `exercises[]` — the **MCP Circuit Item** (`type: "circuit"`) — not as a dedicated tool, not as a renamed `items[]`, and not as a parallel `circuits[]` array.

### Wire shape

```json
{
  "type": "circuit",
  "label": "Finisher",
  "rounds": 3,
  "rest_seconds": 90,
  "transition_seconds": 0,
  "exercises": [
    { "exercise_id": "<uuid>", "amount": 10, "weight_kg": 0 },
    {
      "exercise_id": "<uuid>",
      "per_round": [
        { "amount": 20, "weight_kg": 0 },
        { "amount": 15, "weight_kg": 0 },
        { "amount": 10, "weight_kg": 0 }
      ]
    }
  ]
}
```

- **Native block prescriptions** on the wire: `{ amount, weight_kg }` (flat) or `per_round: [{ amount, weight_kg }, …]`. Never solo `sets` / `reps` / per-exercise `rest_seconds` — those are hard rejects with structured errors.
- **Hybrid richness:** flat path required for the common case; server propagates to all rounds (Builder default). Optional `per_round` for pyramids; if both flat fields and `per_round` are present → reject (no silent winner).
- **Defaults** mirror `file:src/lib/blockPersistence.ts`: rounds=3, rest=90, transition=0, label=null. Bounds: rounds [1,10], 2–8 exercises per Circuit, rest/transition [0,600], weight_kg [0,500], amount reps [1,50] / duration [5,600] by catalog `measurement_type`. A Circuit counts as **one** slot toward the day item cap. Duplicate `exercise_id`s allowed. Array order = **Unified Day Sequence** `sort_order`.
- **`update_program`:** a patched day's `exercises[]` fully replaces that day's Unified Day Sequence (wipe-and-reinsert solos **and** blocks).
- **Read path:** `get_program_details`, `get_upcoming_workouts`, and `get_workout_history` are Circuit-aware. Details/upcoming must be **echo-ready** into write tools. History is round-major grouped actuals (not Circuit Completion Time / PB — follow-up).
- **Naming:** agents and user-facing copy say **Circuit**; persistence stays **Exercise Block**. Superset = Circuit with `transition_seconds: 0`.
- **AI scope (same epic, phased):** Phase 1 = MCP read/write + Program draft / Embedded Agent prompts (onboarding more conservative; Additional program + External MCP fully proactive on training patterns). Phase 2 = Quick Workout AI day-items reshape. No product feature flag — ship ungated when merged; fix bad prompts by revert.

This supersedes ADR 0007 §Decision.4's MCP/AI deferral for the surfaces listed above.

## Consequences

- **Positive:** one day payload expresses mixed solos + Circuits; dry_run stays atomic; solo clients unbroken; agents learn the real block model (`amount` / rounds / transition) instead of a fake progression shape; full-replace `update_program` stays mentally identical to today.
- **Negative:** `exercises[]` is a slight misnomer (can hold Circuits) — documented in tool descriptions + skill rather than a breaking rename. Phase 1 read surface (especially history grouping) is heavier. Strict validators mean more agent retries until skill/examples land.
- **Follow-ups:**
  - Epic Brief + Tech Plan + tickets for #452.
  - Skill + `docs/mcp-connect/*` example prompts (FR/EN) ship with Phase 1.
  - Phase 2 Quick Workout AI contract beyond `exerciseIds[]`.
  - Optional later: Circuit Completion Time on MCP history; Benchmark Circuits (#398) remain a separate epic.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Dedicated `create_circuit` / `add_circuit` tool | Breaks atomic mixed-day dry_run; agents must orchestrate multiple tools to build one day. |
| Rename day field to `items[]` with `exercises[]` legacy alias | Cleaner vocabulary, double cost across skill / validators / Embedded Agent for little agent benefit. |
| Sibling `circuits[]` + `sort_order` | Denies **Unified Day Sequence**; easy to desync order vs solos. |
| Full per-round-only API (no flat path) | High hallucination rate on length/`rounds` alignment for the common flat superset. |
| Reuse solo `reps`/`sets` on Circuit exercises (coerce) | Implies progression semantics Circuits do not have; ranges (`"8-12"`) have no honest mapping to `amount`. |
| Create-only Circuits; `update_program` rejects them | Read-then-edit becomes a footgun (drop or refuse Circuits on existing programs). |
| Quick Workout AI in the same Phase 1 big-bang | Couples PreviewStep redesign to the MCP contract; sequenced as Phase 2 in the same epic instead. |
