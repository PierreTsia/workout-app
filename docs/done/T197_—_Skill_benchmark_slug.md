# T197 — Skill + mcp-connect docs

## Goal

External agents stop minting Cindy-shaped snowflakes. The GymLogic skill and mcp-connect docs tell them to send `benchmark_slug: "cindy"` (aliases Holland → cindy) and that catalog Rx wins. Stories 18, 19, 21 (docs side).

## Mode

**AFK** — wire exists in T191 ; this is prose + examples.

## Slice

`skills/gymlogic-mcp/SKILL.md` + `docs/mcp-connect/*` examples → grep that 5-10-15 is not the recommended persist path for Cindy

## Dependencies

T191 (real wire). Coerce is already in T191 — document it as fallback, not the preferred call.

## Scope

- `skills/gymlogic-mcp/SKILL.md` : replace the labeled AMRAP Cindy example with `benchmark_slug`. Note: unknown slug errors ; generic Circuits omit slug ; label coerce exists but agents should send slug.
- mcp-connect / HITL docs that currently show Cindy as nested 5-10-15 persist : same.
- Do not submit Anthropic Directory in this ticket.

## Out of Scope

- Directory submission (#296).
- Changing prompt closed-intent strings in generators (**T192** owns generate behavior).

## Acceptance Criteria

- [ ] Skill example persist Cindy uses `benchmark_slug`, not a reconstructed 5-10-15 as identity.
- [ ] Docs state catalog wins and unknown slug → error.
- [ ] Generic Circuit example still has no slug.

## References

- Epic Brief stories 18, 19
- Tech Plan Critical Constraint Skill
- T187 skill note (AMRAP) — extend, don’t revert
