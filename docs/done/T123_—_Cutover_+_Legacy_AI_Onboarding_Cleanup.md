# T123 — Cutover + Legacy AI Onboarding Cleanup + Analytics Rename

## Goal

Final Phase B step. Once T120, T121, T122 are merged and soak-validated, **flip `VITE_FEATURE_EMBEDDED_AGENT` to default-on** in production, **remove or dead-code the legacy AI onboarding glue** (`AIGeneratingStep`, `AIProgramPreviewStep`, the AI-only branches of `useGenerateProgram`), and **rename the analytics events** that referenced the old AI flow so funnel data reflects the new shape from day one.

The flip itself is product judgement (HITL); the code removal and event rename are mechanical but need a visual diff review because they touch the most-trafficked funnel page.

Addresses Epic Brief: cutover narrative + Success Criteria. Closes the "Phase B → Phase B default-on" row of the cutover table.

## Mode

**HITL** — flag flip is a product decision; legacy removal needs visual diff; analytics rename can break dashboards if not coordinated.

## Slice

`flag flip → component removal → analytics rename → visual + funnel verification`

## Dependencies

`T120`, `T121`, `T122`

## Scope

### Pre-flight (HITL — maintainer)

- Confirm Privacy Policy + in-app disclosure live in production (T121).
- Confirm Phase B E2E happy path passes on staging (T120 + T122).
- Confirm structured logs visible in Supabase log explorer (T122).
- Confirm whitelisted users have run at least one full chat → preview → commit cycle on production with the flag toggled per-user.

### Flag flip

- Default `VITE_FEATURE_EMBEDDED_AGENT` to `true` (build-time). One-line change in `file:src/lib/featureFlags.ts` from T117.
- Document the flip in the runbook (`file:docs/Runbook_—_MCP_Phase_A_Proof_Endpoint.md` style — small new section in a Phase B runbook, or piggy-back on the same file with a "Phase B" header).

### Legacy code removal

Verify call sites first (search `useGenerateProgram`, `AIGeneratingStep`, `AIProgramPreviewStep`):
- If only the onboarding AI path uses them → **delete** the components and the hook.
- If `useGenerateProgram` is also used by `/builder`'s on-the-fly generation → **dead-code** only the onboarding-side imports / wiring; keep the hook itself for the other caller and add a comment marking it scoped.
- Either way, remove the AI-path branch in `file:src/pages/OnboardingPage.tsx` (the `step === "ai_generating" | "ai_preview"` arms and their handlers).

### `file:supabase/functions/generate-program/`

- **Keep** the Edge function in v1 — Quick Workout / on-the-fly generation may still call into a sibling. Mark the file with a comment that `T119`'s `draft.ts` is the new caller from onboarding and that the `program` quota source is shared.
- Removal of `generate-program` itself is a follow-up after Quick Workout migrates (out of scope per Epic Brief).

### Analytics rename

Old → new (in `file:src/pages/OnboardingPage.tsx` and `file:src/components/onboarding/EmbeddedAgent*`):

| Old `eventType` / payload | New name |
|---|---|
| step name `ai_constraints` | `embedded_agent_started` |
| step name `ai_generating` | `embedded_agent_drafting` |
| step name `ai_preview` | `embedded_agent_preview` |
| `program_created` payload `{ path: "ai" }` | unchanged event, payload `{ path: "ai" }` (single path string is fine — funnel will continue to compare `ai` vs `template` vs `self_directed`) |
| (new) | `embedded_agent_message_sent` (already added in T118) |
| (new) | `embedded_agent_draft_triggered { trigger: "ready_signal"\|"turn_cap"\|"user_cta" }` (added here if not already in T119) |
| (new) | `embedded_agent_preview_rejected` (added here from T120's reject CTA) |

- Update `ANALYTICS_STEP_INDEX` in `OnboardingPage.tsx` to drop the `ai_*` keys.
- Add a one-sentence note in any analytics doc / dashboard README to alert the maintainer that funnel comparisons before/after the flip should reset on the cutover date.

### Tests

- **RTL** — `OnboardingPage.test.tsx`: with flag on (now default), AI path lands directly on `EmbeddedAgentChatStep`; `AIGeneratingStep` is not rendered anywhere in the tree.
- **Vitest** — `useGenerateProgram.test.ts` (if removed): delete the test; otherwise keep but scope to the surviving caller.
- **Smoke**: full E2E (manual or Playwright if present) — onboarding AI happy path + abandon path.

## Out of Scope

- Migrating `VITE_FEATURE_EMBEDDED_AGENT` to a remote/PostgREST flag — deferred follow-up post-GA, not in this batch.
- Removing the `generate-program` Edge function — depends on Quick Workout migration (Epic Brief explicit out-of-scope).
- New analytics dashboards — maintainer ops task.

## Acceptance Criteria

- [ ] `VITE_FEATURE_EMBEDDED_AGENT` defaults to `true`; AI path renders the Embedded Agent flow without env var setup.
- [ ] Legacy `AIGeneratingStep` is no longer reachable from `OnboardingPage`; component file is either deleted (preferred) or marked unused with a removal-target comment if still referenced from elsewhere.
- [ ] Legacy `AIProgramPreviewStep` is no longer reachable from `OnboardingPage`; same disposition rule.
- [ ] `useGenerateProgram` either fully deleted or pruned to its remaining caller; no dead imports in `OnboardingPage`.
- [ ] Analytics events renamed per the table; old `ai_constraints` / `ai_generating` / `ai_preview` strings absent from production code.
- [ ] Pre-flight checklist (Privacy live, E2E green, logs visible, whitelisted dogfood done) signed off in the PR description.
- [ ] No regression on Template / Blank paths (Story 16 still holds — they never see the chat).

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md` — Phase A → Phase B cutover
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295_Phase_B.md`
- Glossary: `file:docs/CONTEXT.md` — locked decisions
- Phase A runbook style: `file:docs/Runbook_—_MCP_Phase_A_Proof_Endpoint.md`
