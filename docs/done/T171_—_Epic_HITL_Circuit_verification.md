# T171 — Epic HITL Circuit verification

## Goal

Valider manuellement les success measures HITL du brief avant de clôturer l’epic #452.

## Mode

**HITL** — jugement qualité réel (proactivité, consentement dry_run, fidélité in-app).

## Slice

Manuel : External MCP Client + PWA Builder/session (+ onboarding AI path)

## Dependencies

T164, T165, T166, T167, T169, T170.

## Scope

Run and record:

1. **Finisher** — FR: *"ajoute un circuit finisher 3 tours burpees / KB swing / plank sur mon Push"* → dry_run → apply → Builder/session OK.
2. **Pyramide** — FR: *"circuit pyramidal 20-15-10 …"* → dry_run expand → `per_round` persisted.
3. **Onboarding garde-fou** — first-program AI for generic strength beginner does **not** emit agonist/antagonist supersets unless asked.

## Out of Scope

- New features ; CCT/PB ; Benchmark Circuits.

## Acceptance Criteria

- [ ] Finisher HITL pass documented (notes or issue comment).
- [ ] Pyramid HITL pass documented.
- [ ] Onboarding garde-fou HITL pass documented.
- [ ] Blocking bugs filed or fixed before epic close.

## References

- Epic Brief success measures
- #452
