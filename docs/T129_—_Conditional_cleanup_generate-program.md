# T129 — Conditional cleanup: delete `generate-program/`

## Goal

Close the long-standing **T123 punt** by deleting `file:supabase/functions/generate-program/` — the legacy onboarding-AI Edge function whose deletion was deferred when the Embedded Agent migration shipped (#295 Phase B). After T126 migrated `embedded-agent` to use `_shared/programCatalog.ts` and #343 retired the post-onboarding AI wizard UI, `generate-program/` has zero callers and can disappear.

This ticket is **conditional**: it ships only after #343's post-onboarding AI wizard cleanup is merged (per the Epic Brief's Sequencing section). If #343 ships first, this ticket is moved into #343 and deleted from #342. If #342 ships first (default expectation), this is the closing act of the epic — landing after #343's UI-side deletion is in.

Addresses **Epic Brief stories 19, 20** (decommission `generate-program`) and the Sequencing-with-#343 framework.

## Mode

**AFK** — pure code deletion. **Hard precondition**: #343 merged with the post-onboarding wizard cleanup. The PR opener verifies via `gh pr list --state merged --search "#343"` before merging this ticket. Mechanical check, not a judgment call.

## Slice

`rm -r supabase/functions/generate-program/` → `git grep` verifies zero references → CI green

## Dependencies

- **T126** — already migrated `embedded-agent` off `generate-program`'s embedded calls (via `_shared/programCatalog.ts`).
- **T127** — Quick Workout AI no longer references `generate-program` (the path moved to `generate-quick-workout/`).
- **T128** — full epic flow proven via Playwright E2E.
- **#343 merged** — the post-onboarding AI wizard UI is gone; nothing in the PWA still calls `/functions/v1/generate-program`.

## Scope

### Deletion

| Path | Action |
|---|---|
| `file:supabase/functions/generate-program/` (whole folder) | `git rm -r` |
| Any test fixtures referencing `generate-program` | Audit and remove if dead |
| Documentation references in `docs/` | Audit; update or annotate as historical (e.g. T46, T119 docs in `docs/done/` may reference it — those are historical artifacts and **stay untouched**) |

### Verification (pre-merge)

| Check | How |
|---|---|
| Zero callers in code | `git grep -E "generate-program\|generateProgram" -- 'src/**' 'supabase/functions/**'` returns nothing in active code paths (the `_shared/aiQuota.ts`'s `'program'` enum value is unrelated and stays — that's quota source attribution, not a function reference) |
| #343 fully merged | `gh pr list --state merged --search "#343"` shows the post-onboarding wizard cleanup PR is in `main` |
| Local Supabase healthy | `supabase functions list` after deletion does not show `generate-program` |
| CI green | `npm test` + `npm run test:e2e` pass |

### If #343 has NOT yet shipped at the time this ticket is picked up

**Do not merge.** Either:
- (a) Wait for #343 to land, then proceed.
- (b) Move the ticket into #343 itself (transferring ownership); close this one with a note linking to the new home.

Per the Epic Brief Sequencing section: *"If #343 ships first, `generate-program` deletion moves to #343; if #342 ships first, deletion stays in #342 as tail-end follow-up."* This ticket is the latter form.

## Out of Scope

- Any code change other than file deletion
- Migration of `generate-program`'s catalog/profile/history helpers (already done in T126; this ticket only deletes the residual function)
- Changes to the `'program'` quota source value or its CHECK constraint entry (that value is shared with `embedded-agent`'s draft path and stays)

## Acceptance Criteria

- [ ] **Precondition verified**: #343's post-onboarding AI wizard cleanup PR is merged into `main` at the time this PR is opened. Linked PR # in the description.
- [ ] `supabase/functions/generate-program/` no longer exists in the repo.
- [ ] `git grep generate-program -- 'src/**' 'supabase/functions/**'` returns zero results in active code (excluding `docs/done/` historical artifacts and migration files referencing the `'program'` quota source).
- [ ] `git grep generateProgram -- 'src/**'` returns zero results.
- [ ] `npm test` passes (no broken imports).
- [ ] `npm run test:e2e` passes (no regression on AI flows — onboarding via Embedded Agent, Quick Workout AI via the new path).
- [ ] `supabase functions deploy` deploys cleanly (verifies no Deno import-graph break).
- [ ] PR description explicitly states "deletes the function whose removal was punted from T123" and links to #343's merged cleanup PR.

## References

- [Epic Brief — Quick Workout AI to Embedded Agent + MCP (#342)](./Epic_Brief_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — stories 19, 20; "Sequencing with #343" section
- [Tech Plan — Quick Workout AI to Embedded Agent + MCP (#342)](./Tech_Plan_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md) — sections "Critical Constraints" (deletion timing), "Sequencing & Migration"
- [Epic Brief — Onboarding — MCP-First and Embedded Agent (#295)](./Epic_Brief_—_Onboarding_—_MCP-First_and_Embedded_Agent_#295.md) — context for the original T123 punt
- GitHub issue [#343](https://github.com/PierreTsia/workout-app/issues/343) — post-onboarding AI wizard cleanup (the gating PR)
