# ADR 0031 — The Decision Card renders a structured program: additive `structuredContent`

- **Status:** Accepted
- **Date:** 2026-10-06
- **Decided in:** grilling for [#651](https://github.com/PierreTsia/workout-app/issues/651) (design refinement of the MCP cards)
- **Extends:** ADR [0028](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0028-view-intention-and-consent-token.md) (the **Decision Card**, `ui://gymlogic/program-patch`)

## Context

ADR 0028 shipped the **Decision Card** as the human surface of `update_program` `dry_run`. Today its `structuredContent` carries `rendered` — a **markdown string, English-only** (`Benchmark Press — 5 × 5 × 100 kg total — 180s rest`) — plus `removed_days` / `added_days` / `warnings`. The card dumps `rendered` into a `<pre>`, so it reads as raw output, not as a program.

A real card needs **typed data**: the days and their exercises, the prescription fields, and — for a patch — **what changed** on each exercise. That data already exists server-side (`formatProgramAfterUpdate` computes `RenderableDay[]` before flattening it to markdown; the handler holds `CurrentProgramSnapshot` and `ProgramDiff`), but it is discarded at the wire.

Changing what `update_program` returns is a **public MCP contract change**: non-MCP-Apps hosts (Cursor, Le Chat) read the model-visible result and must not regress.

## Decision

We will:

1. **Make the change additive.** `update_program` `dry_run:true` adds `locale` and `program` (`{ name, days[] }` with typed exercises) **to `structuredContent` only** — alongside the untouched `rendered`, `removed_days`, `added_days`, `warnings`, and the existing `preview_token`. The model-visible `payload` / `content[0].text` is **not** changed.
2. **Keep `structuredContent` outside model context.** Like the **Preview Token** (ADR 0028), the structured program rides `structuredContent` (SEP-1865) so it neither bloats nor leaks into the agent's context; the markdown `rendered` stays the model's channel.
3. **Carry a `locale` (`en` | `fr`).** Resolved by precedence: the tool's optional `locale` argument → `user_profiles.locale` → `en`, via the existing `resolveCardLocale` (the same rule as `render_session_card`). The view rebuilds prescription copy from typed fields in that locale; the markdown stays English.
4. **Emit per-exercise change markers, exercise grain.** Each solo exercise carries `change: ("sets" | "reps" | "weight" | "rest")[] | null` (null = unchanged / not comparable) and `isNew` for exercises of an inserted day. The **view** composes the localized caption; the payload carries only typed data. Comparison is field-level, normalized (weight is a string, reps may be a range). A `bare` parsed exercise (UUID only, no prescription) is never flagged changed. Exercises removed from an updated day stay surfaced by `warnings`, not re-emitted.
5. **Stay backward-compatible.** A host or cached result without `program` falls back to `rendered`; the field is optional on the view payload.

## Consequences

- **Positive:** the click path (ADR 0028) is unchanged and still enforced by the Preview Token; the card gains a real, localized rendering with zero new write path; the same `ProgramDiff` + snapshot are reused — no schema, no migration, no state. Non-MCP-Apps clients are untouched (`rendered` and the model result are byte-identical).
- **Negative:** `structuredContent` grows (program days on every preview) — accepted, it is out of model context. The change detection is a **heuristic**: matching is by `exercise_id` then `sort_order` (index fallback), so a reordered day with duplicate `exercise_id`s can produce a spurious "changed" — accepted as a UI annotation, never authoritative (the `rendered`/apply remain the source of truth).
- **Follow-ups:** a dedicated read-only Program Card (`get_program_details`) is a separate epic — it needs a new tool + ADR; this ADR only structures the patch preview.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Parse `rendered` markdown in the view** | Duplicates a server format, and the markdown is English-only — the card must localize. |
| **Replace `rendered` with `program`** | Breaks every non-MCP-Apps client that reads the model result; `rendered` is the model's channel. |
| **Put `program` in the model-visible `payload`** | Bloats the agent context with data only the view needs, and duplicates what `rendered` already gives the model. |
| **Per-set change granularity** | The mockup shows "sets 2-3 changed", but per-set structure is heavier for marginal value; exercise-grain field markers are enough to guide the eye. |
| **New read-only Program Card in this epic** | Out of scope: a new tool + ADR is its own epic; the patch preview is the job here. |
