# Epic Brief — MCP & AI Circuits

## Summary

Fermer le gap volontaire d'ADR 0007 : après les Circuits in-app (#351), les agents — **External MCP Client** et flux AI programme — peuvent lire, créer et éditer des **Circuits** (**Exercise Blocks**) dans la **Unified Day Sequence**, via le **MCP Circuit Item** (`type: "circuit"` dans `exercises[]`). L'agent le fait sur demande explicite ou de façon proactive quand c'est le bon shape (superset, finisher, conditioning). Phase 1 = MCP + Program AI ; Phase 2 = **Quick Workout AI** (même epic).

---

## Context & Problem

**Who is affected:** Users qui coachent via Claude/Cursor/etc. (**External MCP Client**) ; users des flux **Embedded Agent onboarding** / **Additional program creation** ; plus tard users **Quick Workout AI**. Indirectement : toute surface qui lit un programme contenant déjà des Circuits créés au Builder.

**Current state:**
- Circuits shippés in-app (Builder, **Round Screen**, history) — #351 / ADR 0007.
- MCP write (`create_program`, `create_workout_day`, `update_program`) : `exercises[]` plat (UUID | prescription solo) uniquement.
- MCP read (`get_program_details`, upcoming, history) : ignore `exercise_blocks` — jours avec Circuits incomplets / mensongers.
- Skill + tool descriptions : zéro Circuit ; ADR 0007 §Decision.4 + Epic Brief Circuits mettaient MCP/AI explicitement out of scope v1.
- Contrats figés en grilling + ADR 0011 / glossary **MCP Circuit Item**.

**Pain points:**
| Pain | Impact |
|---|---|
| Agent ne peut pas exprimer un Circuit | Flatten en solos → perte rounds / transition / rest inter-rounds |
| Reads MCP aveugles aux Circuits | `update_program` full-replace dangereux ; coaching sur "demain" faux |
| AI programme ne propose jamais de Circuit | Parité MCP-first cassée vs Builder |
| Quick Workout AI = `exerciseIds[]` plat | Structurellement incapable de Circuit (Phase 2) |

---

## User Stories

**External MCP — write**
1. As a user talking to an **External MCP Client**, I want to ask for a Circuit (superset / triset / finisher) and have it persisted on a program day via `create_program` or `create_workout_day` (`dry_run` then apply), so that I don't finish the structure in the Builder.
2. As a user, I want to add or replace a Circuit on an existing program day via `update_program` (full-day **Unified Day Sequence** replace), so that edits don't orphan or silently drop **Exercise Blocks**.
3. As a user, I want a dry_run preview that renders Circuits clearly (compact if flat, round-by-round if pyramidal), so that I consent to the right numbers.
4. As a user, I want solo-only payloads to keep working unchanged, so that existing agent workflows don't break.
5. As a user, I want validation errors to reject solo-shaped fields inside a Circuit (`sets`, `reps`, per-exo `rest_seconds`) and flat+`per_round` together, so the agent learns the native `{ amount, weight_kg }` model.
6. As a user, I want Circuit defaults (rounds=3, rest=90, transition=0, label null) and bounds (2–8 exos, rounds [1,10], …) to match Builder/MCP solo conventions, so agents aren't forced to over-specify.
7. As a user, I want a Circuit-only day (no solos) to be creatable and startable, so conditioning sessions aren't blocked.
8. As a user, I want the same exercise twice in a Circuit (complexes), so MCP parity with Builder holds.

**External MCP — read**
9. As a user, I want `get_program_details` to return Circuits interleaved with solos by `sort_order` in an **echo-ready** shape, so an agent can round-trip into `update_program` without drift.
10. As a user, I want `get_upcoming_workouts` to show Circuits in tomorrow's session, so the agent doesn't under-describe the day.
11. As a user, I want `get_workout_history` to group Circuit actuals round-major (like the in-app history card), so coaching on past finishers is accurate — without requiring **Circuit Completion Time** / PB in this epic.

**Agent guidance & consent**
12. As a user, I want the skill + tool descriptions to use "Circuit" (never "block"), teach when to propose one, and mention once that Circuits have frozen prescriptions (no progression), so expectations match ADR 0007.
13. As a user, I want proactive Circuit suggestions on training patterns (conditioning, finishers, classic agonist/antagonist supersets) for External MCP and **Additional program creation**, so I don't have to say the magic word every time.
14. As a first-time onboarding user, I want **Embedded Agent onboarding** to be more conservative (Circuits mainly on explicit ask or obvious conditioning finishers), so my first program isn't overloaded with supersets and **Round Screen** novelty.
15. As a user, I want example prompts (FR/EN) in `docs/mcp-connect` + skill updates shipped with Phase 1, so discovery isn't tribal knowledge.

**Embedded Agent / Program draft (Phase 1)**
16. As a user on AI program creation, I want the **Program draft step** / `create_program` path to accept and persist **MCP Circuit Items**, so in-app AI isn't structurally weaker than Claude Desktop.
17. As a user, I want the **Onboarding program commit gate** unchanged (`dry_run` → confirm → apply), so Circuits don't invent a new consent model.
18. As a user who rejects a preview containing Circuits, I want regenerate to work on the same thread, so Circuit-heavy drafts aren't a dead end.

**Quick Workout AI (Phase 2)**
19. As a user of **Quick Workout AI**, I want the generator + PreviewStep + `commit-quick-workout` to support day items that include Circuits (not only `exerciseIds[]`), so a one-shot conditioning session can be a real Circuit.
20. As a user editing a Quick Workout preview, I want to see Circuits distinctly before commit, so I can fix or remove them like solos.

**Errors / edges / non-regression**
21. As a user, I want clear structured MCP errors when a Circuit fails validation (too few exos, bad `amount` for measurement type, bodyweight `weight_kg` > 0, etc.), so the agent can repair in one turn.
22. As a user offline in the PWA, I want existing offline behavior for Builder-created Circuits unchanged — MCP/AI Circuit creation remains online-only (same as today's MCP/AI), so we don't invent a new offline write path.
23. As a user with a 100% solo program, I want zero behavior change on read/write MCP and AI paths, so this epic is additive.
24. As an agent, I want `weight_kg` on the wire for both flat and `per_round` (mapped to DB `weight` at persistence), so I don't juggle two weight field names.

### Success measures

| Story # | Measure |
|---|---|
| 1–3 | HITL FR finisher: *"ajoute un circuit finisher 3 tours burpees / KB swing / plank sur mon Push"* → dry_run shows Circuit → apply → Builder/session correct |
| 3 | HITL FR pyramide: *"circuit pyramidal 20-15-10 burpees / swing / plank, 3 rounds"* → dry_run expand round-by-round with distinct amounts → apply preserves `per_round` |
| 4, 23 | Existing solo MCP integration tests / Deno suites still green without payload changes |
| 9 | Verbatim echo of `get_program_details` Circuit into `update_program` dry_run succeeds |
| 14 | HITL onboarding garde-fou: first-program AI path for a generic strength beginner does **not** emit agonist/antagonist supersets unless asked (Circuits only on explicit ask or obvious conditioning finisher) |
| 16–18 | Embedded Agent draft can commit a program containing ≥1 Circuit through the existing commit gate |
| 19–20 | Quick Workout AI can preview + commit ≥1 Circuit (Phase 2 exit) |

---

## Scope

**In scope:**

**Phase 1**
- **MCP Circuit Item** wire + validation + persistence for `create_program`, `create_workout_day`, `update_program` (ADR 0011).
- Read: `get_program_details`, `get_upcoming_workouts`, `get_workout_history` (grouped actuals; no CCT/PB).
- Adaptive dry_run / preview rendering ; echo-ready details.
- Skill + tool descriptions + `docs/mcp-connect/*` example prompts (FR/EN).
- **Program draft step** / Embedded Agent prompts: proactive (Additional program + patterns) ; conservative onboarding.
- Supersede ADR 0007 MCP/AI deferral for these surfaces (via ADR 0011).

**Phase 2 (same epic)**
- **Quick Workout AI** contract beyond `exerciseIds[]` ; PreviewStep + `commit-quick-workout` / `create_workout_day` Circuit-aware end-to-end.
- Prompt guidance for when QW should emit Circuits.

**Out of scope:**
- **Benchmark Circuits** (#398).
- Progression engine for blocks (ADR 0007).
- In-session grouping/ungrouping.
- **Circuit Completion Time** / PB / deltas on MCP history.
- Marketing / Anthropic directory copy.
- Feature flag runtime (ship ungated ; revert prompts if needed).
- Dedicated `create_circuit` tool ; rename to `items[]` ; sibling `circuits[]`.

---

## Success Criteria

- **Qualitatif :** un user Claude peut créer et éditer un programme avec solos + Circuits (dont pyramide), les voir dans upcoming/details/history MCP, et les retrouver fidèles in-app — sans jamais lire le mot "block".
- **Parité AI Phase 1 :** Additional program / External MCP proposent des Circuits sur les bons patterns ; onboarding reste prudent ; commit gate inchangé.
- **Phase 2 :** Quick Workout AI preview+commit d'au moins un Circuit conditioning typique.
- **Non-régression :** payloads et programmes 100 % solo inchangés.
- **Contrato :** ADR 0011 + glossary **MCP Circuit Item** respectés (reject strict, hybrid, full-day replace).

---

## References

- Issue : [#452](https://github.com/PierreTsia/workout-app/issues/452)
- ADR : `file:docs/adr/0011-mcp-circuit-items-in-exercises-array.md` (supersedes MCP deferral in ADR 0007 §Decision.4)
- Prior epic : `file:docs/Epic_Brief_—_Supersets_&_Circuits_(Exercise_Blocks).md` (#351) — MCP/AI were out of scope there; this epic closes that deferral without rewriting that brief
- Glossary : **MCP Circuit Item**, **Exercise Block**, **Circuit**, **Unified Day Sequence**, **Per-round Prescription**, **External MCP Client**, **Embedded Agent**, **Program draft step**, **Quick Workout AI** — `file:docs/CONTEXT.md`
- MCP tools : `file:supabase/functions/mcp/tools/createProgram.ts`, `createWorkoutDay.ts`, `updateProgram.ts`, `getProgramDetails.ts`, …
- In-app persistence reference : `file:src/lib/blockPersistence.ts`, `file:src/hooks/useBlockMutations.ts`
