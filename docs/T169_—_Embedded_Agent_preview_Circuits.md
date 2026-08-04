# T169 — Embedded Agent preview Circuits

## Goal

Le commit gate (`EmbeddedAgentPreviewStep`) affiche les Circuits du draft et un décompte items honnête. Stories Epic 16–18 (UI).

## Mode

**AFK**

## Slice

`last_preview` args/rendered → PreviewBody → i18n → Vitest

## Dependencies

T168.

## Scope

- Render Circuit lines from MCP `rendered` and/or structured args.
- i18n : program line as items with solos/circuits breakdown (not raw `exercises.length` as “exercises” only).
- Regenerate / commit gate behavior unchanged.

## Out of Scope

- Changing commit consent model ; QW PreviewStep (T170).

## Acceptance Criteria

- [ ] Preview with ≥1 Circuit shows Circuit content (label/rounds or rendered lines).
- [ ] Subtitle/count distinguishes solos vs circuits.
- [ ] Missing preview / regenerate paths still work (Vitest).
- [ ] Solo-only preview unchanged.

## References

- Epic : `file:docs/Epic_Brief_—_MCP_&_AI_Circuits.md`
- `file:src/components/embedded-agent/EmbeddedAgentPreviewStep.tsx`
