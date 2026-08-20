# T203 — Pantheon skill + ADR + glossary

## Goal

Les agents cessent d’inventer un Zeus 5-10-15. Le skill / mcp-connect listent les 8 slugs. ADR 0017 fige la vague AMRAP + `label`. Le glossaire arrête de dire que Zeus est le jumeau Tours de Cindy. Stories 17, 18.

## Mode

**AFK** — prose + ADR template ; no product forks left.

## Slice

`skills/gymlogic-mcp/SKILL.md` + `docs/mcp-connect/example-prompts.md` → `docs/adr/0017-…` → `docs/CONTEXT.md`

## Dependencies

T202 (slugs exist in DB ; don’t document phantom rows).

## Scope

### Skill + mcp-connect

- `file:skills/gymlogic-mcp/SKILL.md` : named WODs = Cindy **and** the 8 pantheon slugs. Catalog Rx wins. Unknown slug → error. Generic Circuit omits slug. Do **not** recommend reconstructing Zeus burpees as identity.
- `file:docs/mcp-connect/example-prompts.md` : keep Persist Cindy ; add Persist Zeus (`benchmark_slug: "zeus"`).
- QW closed-intent Cindy-only : one line that pantheon QW coerce is **out** (#480), not a bug.

### ADR

- `docs/adr/0017-pantheon-amrap-seeds-and-label.md` from Tech Plan : this wave is AMRAP Cindy-shaped ; `label` is the display name ; Tours-benchmark / pyramid catalog deferred ; QW coerce not generalized.

### Glossary

- `file:docs/CONTEXT.md` **Benchmark Circuit** / Zeus : drop « Zeus is the Tours twin ». Point at pantheon seeds (AMRAP) + `label`.
- Add **Olympien** / **Héros** (editorial casts, no column) and **Specialty** (tagline, one per matrix column).

## Out of Scope

- Code, migrations, QW `CINDY_SEED_KEYS`.
- Directory submission (#296).
- Circuit Catalog UI, achievements.

## Acceptance Criteria

- [ ] Skill persist examples for named WODs use `benchmark_slug`, never a reconstructed Rx as identity. Slugs listed : `cindy`, `zeus`, `heracles`, `ares`, `theseus`, `athena`, `atlas`, `hades`, `achilles`.
- [ ] Docs : unknown slug → error ; generic Circuit has no slug.
- [ ] `example-prompts.md` has a Zeus persist example.
- [ ] ADR 0017 exists (AMRAP-only wave, `label`, Tours deferred).
- [ ] `CONTEXT.md` has no « Zeus = Tours twin » claim ; Olympien / Héros / Specialty defined.
- [ ] `rg CINDY_SEED_KEYS` still only in QW replace (unchanged this ticket).

## References

- Epic Brief `file:docs/Epic_Brief_—_Pantheon_#480.md` (stories 17–18, out of scope QW)
- Tech Plan `file:docs/Tech_Plan_—_Pantheon_#480.md` (docs / ADR / glossary)
- T197 pattern `file:docs/T197_—_Skill_benchmark_slug.md`
