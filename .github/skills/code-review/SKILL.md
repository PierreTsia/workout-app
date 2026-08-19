---
name: code-review
description: >
  Review GymLogic pull requests for product lies and ADR/invariant breaks.
  Use whenever reviewing a PR, leaving review comments, or auditing a diff
  against docs/CONTEXT.md and docs/adr/. Do not use for generic style advice
  or to rewrite map/flatMap into for-loops.
---

# GymLogic code review

Review the **diff + PR title/body + tests**, not a generic style guide. Load canonical docs; do not paste them into comments.

## Load before commenting

1. PR title and body — claims to verify.
2. The diff.
3. `file:docs/CONTEXT.md` terms the diff touches.
4. Cited ADRs under `file:docs/adr/` (especially 0007, 0009, 0010, 0011, 0012).
5. If the PR touches MCP: `file:skills/gymlogic-mcp/SKILL.md` and `file:supabase/functions/mcp/tools/registry.ts`.

`README.md` and `file:docs/PRD.md` lag. Do not review *against* them. Do flag them when this PR makes them wrong.

House style is `.cursor/rules/`. Do not contradict it.

## Hunt lies

Comment when any of these is true:

- **PR claim vs diff** — title/body promises behavior the diff does not implement (or implements the opposite).
- **Tests/docs encode the old behavior** — assertions, fixtures, or copy still describe the pre-PR world.
- **User-facing "block"** — i18n **values**, labels, dialog titles, history cards say "block" instead of **Circuit**. Keys like `blockRunner.*` / `createBlock` are fine (ADR 0007). FR and EN both say **Circuit**.
- **In-app AI UI names a model vendor** — Gemini, Groq, Claude, ChatGPT in PWA copy. Provider is infrastructure (logs/Sentry only). ADR 0009.
- **Stale MCP tool counts** — this PR changes the MCP surface (registry, tool handlers, skill) but `README.md` or `file:docs/mcp-connect/` still lists the old set. Count from `file:supabase/functions/mcp/tools/registry.ts`.

## Hunt ADR / invariant breaks

- **Circuit vs Exercise Block** — UI/MCP-to-agents = Circuit. Tables/types/hooks/i18n **keys** = block. Never leak "Exercise Block" to users. ADR `file:docs/adr/0007-exercise-blocks-rich-structure-no-progression.md`.
- **No progression engine on circuits** — no Progression Suggestion / Prescription Snapshot / Progression Rule on block cells.
- **Agent proposes, user confirms** — writes go `dry_run: true` → explicit confirm → `dry_run: false`. No auto-commit.
- **`update_program` omit-a-day = delete** — `days[]` is declarative. Do not recreate a program with `create_program` to edit; that orphans history.
- **Last Performance is slot-scoped** — `(workout_exercise_id, exercise_id)`, not catalog-global. ADR `file:docs/adr/0012-slot-scoped-last-performance.md`.
- **Weight convention** — dumbbell / kettlebell = per-hand; barbell / machine / cable / `ez_bar` = total. Storage always kg (`weightUnitAtom` is display only).
- **Catalog names at display time** — resolve `name_en` / `name` from the joined catalog row; snapshots are fallback. ADR `file:docs/adr/0010-localize-catalog-at-display-time.md`.
- **MCP is additive** — in-app path must not regress when MCP tools grow.

## Do not comment on

- Replacing `.map()` / `.flatMap()` / `.filter()` with `for` + `Set.add` / `.push`. House style prefers the pipeline unless a hot path is **profiled**. False positive: PR #490.
- Formatting, import order, “add a comment”, rename-for-taste.
- Anything you cannot pin to a lie, an invariant above, a CONTEXT term, an ADR, or a concrete defect (crash / data loss / auth).

## How to comment

One finding per thread. Cite the CONTEXT term or ADR (`0007`, `0012`, …). Stay silent when the diff is clean.
