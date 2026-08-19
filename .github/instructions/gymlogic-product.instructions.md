---
applyTo: "src/**,supabase/**,docs/**"
---

# GymLogic product review (src / supabase / docs)

Apply on top of `file:.github/copilot-instructions.md`. Canonical language is `file:docs/CONTEXT.md`; decisions are `file:docs/adr/`. Do not treat `README.md` or `file:docs/PRD.md` as truth.

When reviewing, also follow `file:.github/skills/code-review/SKILL.md`.

## Invariants

- **Circuit** is the user-facing name. **Exercise Block** is code-only (tables `exercise_blocks` / `block_exercises`, hooks, i18n **keys**). UI strings, MCP-to-agents, and docs that users read say Circuit — never "block". ADR 0007.
- Circuits are **out of the progression engine**. Frozen prescription; Builder-edited; no suggestion / snapshot / rule on block cells.
- **Agent proposes / user confirms.** No auto-commit. `dry_run: true` first.
- **`update_program`**: omitted day = DELETE. Never `create_program` to edit an existing program (orphans history).
- **Last Performance** is slot-scoped: `(workout_exercise_id, exercise_id)`. ADR 0012.
- **Weight**: dumbbell / kettlebell per-hand; barbell / machine / cable / `ez_bar` total. Persist kg only.
- **Catalog labels** resolve at display time from the joined `exercises` row. Snapshots are fallback. ADR 0010.
- **In-app AI UI** never names Gemini / Groq / Claude. ADR 0009.
- **MCP is additive.** Growing the tool list must not regress the in-app path.
- If this change adds/removes an MCP tool, `README.md` and `file:docs/mcp-connect/` must match `file:supabase/functions/mcp/tools/registry.ts` — those docs currently lag.

## Do not nitpick

Do not ask to rewrite `.map()` / `.flatMap()` / `.filter()` into `for` loops or `Set.add`. That is house style (`file:.cursor/rules/prefer-functional-style.mdc`) unless a hot path is profiled. Copilot false-positive: PR #490.
