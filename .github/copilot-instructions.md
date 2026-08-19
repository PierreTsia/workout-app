# GymLogic — Copilot instructions

MCP-native workout tracker (React 19 + TypeScript PWA, Supabase Edge/MCP, Vitest). Cursor house rules live in `.cursor/rules/` — do not contradict them. There is no `AGENTS.md` on purpose.

## Canonical docs

Read these; do not treat this file as a substitute:

- `file:docs/CONTEXT.md` — ubiquitous language
- `file:docs/adr/` — accepted decisions
- `file:skills/gymlogic-mcp/SKILL.md` — MCP agent contract

Count MCP tools from `file:supabase/functions/mcp/tools/registry.ts`, never from `README.md` or `file:docs/PRD.md`. Those two lag. If a PR changes the MCP surface and leaves them stale, that lag is a **finding**, not a source of truth.

## Pull request review

When reviewing a PR, follow `file:.github/skills/code-review/SKILL.md`. Product paths also load `file:.github/instructions/gymlogic-product.instructions.md`.

Your job is **product lies** and **ADR/invariant breaks**. Silence is correct for generic style.

## Banned nits

Do **not** ask to revert `.map()` / `.flatMap()` / `.filter()` pipelines to `for` loops, `Set.add`, or other mutable accumulators. House style is `file:.cursor/rules/prefer-functional-style.mdc`. Raise a loop only when a hot path is **profiled**, not assumed. Copilot got this wrong on PR #490 (`countBlockSetsDone`).

Skip formatting, import order, and taste-level renames. If you cannot cite a CONTEXT term, an ADR, a PR-claim mismatch, or a concrete defect (crash / data loss / auth), do not comment.
