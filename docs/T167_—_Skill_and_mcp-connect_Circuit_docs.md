# T167 — Skill + mcp-connect Circuit docs

## Goal

Skill, tool descriptions et example-prompts enseignent Circuits (naming, when-to-propose, JSON fence round-trip). Stories Epic 12, 15.

## Mode

**AFK**

## Slice

SKILL.md → tool description strings → `docs/mcp-connect/*` examples

## Dependencies

T163, T165.

## Scope

- `file:skills/gymlogic-mcp/SKILL.md` : shape wire, heuristics, progression mention×1, never “block”, **update via JSON fence from details**.
- Update `create_program` / `create_workout_day` / `update_program` / read tool descriptions.
- `docs/mcp-connect/example-prompts.md` (+ connect pages if tool tables list writes) : FR/EN finisher, pyramide, update-echo.

## Out of Scope

- Anthropic directory / marketing ; code behavior changes.

## Acceptance Criteria

- [ ] Skill documents `type: "circuit"` hybrid shape + JSON fence rule.
- [ ] No user-facing “block” in skill/tool copy.
- [ ] ≥1 FR + ≥1 EN example prompt for Circuit create ; ≥1 for update echo.
- [ ] Tool descriptions mention Circuits where `exercises[]` is documented.

## References

- Epic : `file:docs/Epic_Brief_—_MCP_&_AI_Circuits.md`
- ADR 0011
