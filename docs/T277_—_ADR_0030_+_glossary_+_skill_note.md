# T277 — ADR 0030 + glossary + skill note

## Goal

Record the decision and align the shared language: ADR 0030, the **Exercise
Slot** / **Last Performance** glossary entries, the ADR index, and the
`gymlogic-mcp` skill's `update_program` behaviour note. Addresses Epic Brief
story 6 (contract clarity).

## Dependencies

T275, T276.

## Scope

- `file:docs/adr/0030-update-program-slot-reconciliation.md` — decision,
  consequences, alternatives (relates to 0012 / 0006).
- `file:docs/adr/README.md` — index row 0030.
- `file:docs/CONTEXT.md` — **Exercise Slot** / **Last Performance** note that
  `update_program` preserves slot identity by reconciliation.
- `file:skills/gymlogic-mcp/SKILL.md` — one sentence: a targeted prescription
  change keeps the slot's progression; swapping the movement starts a fresh
  slot (expected reset).

## Out of Scope

- Any code change.

## Acceptance Criteria

- [ ] ADR 0030 follows the `docs/adr/README.md` shape and is indexed.
- [ ] `CONTEXT.md` states the reconciliation behaviour on **Exercise Slot** /
      **Last Performance**.
- [ ] The skill note matches the shipped behaviour.
- [ ] `npm run lint` passes.

## References

- Epic Brief `file:docs/Epic_Brief_—_MCP_update_program_slot_identity_#666.md`
- Tech Plan `file:docs/Tech_Plan_—_MCP_update_program_slot_identity_#666.md`
