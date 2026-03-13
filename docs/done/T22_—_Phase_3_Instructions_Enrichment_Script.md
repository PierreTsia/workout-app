# T22 — Phase 3 — Instructions Enrichment Script

## Goal

Backfill `exercises.instructions` (JSONB) for imported exercises (excluding the 23 hand-curated ones) where `instructions IS NULL`, using LLM (free tier, e.g. Hugging Face) or template generation. Instructions are in French and match the same shape as seed data: `setup`, `movement`, `breathing`, `common_mistakes` (each string[]). The script is idempotent: re-runs do not overwrite existing non-null `instructions`.

**Note:** The Epic Brief defers “Generated instructions for imported exercises” to a later epic. This ticket implements the Tech Plan’s Phase 3; omit or defer if following Epic scope only.

## Dependencies

- **T19 — Enrichment Strategy and Shared Config.** Requires [file:scripts/enrichment-config.ts](scripts/enrichment-config.ts) (LLM endpoint/key or template choice) and the exclusion-set helper so the script never updates the 23.

## Scope

### Script: enrich-instructions.ts

Create [file:scripts/enrich-instructions.ts](scripts/enrich-instructions.ts) as a Node/TS batch script following the pattern of [file:scripts/import-exercises.ts](scripts/import-exercises.ts).

| Responsibility | Detail |
|----------------|--------|
| Exclusion set | At start, resolve the 23 names to exercise IDs using the T19 helper; store as `Set<string>` excludedIds. |
| Candidate query | Fetch exercises where `instructions IS NULL` and `id` not in excludedIds (imported). Order by same prioritization heuristic as Phase 1/2 (from strategy). |
| Per exercise | Generate JSON with keys `setup`, `movement`, `breathing`, `common_mistakes` (each string[]) using LLM free tier or template from name/muscle_group/equipment. Output language: French. |
| Validation | Validate shape (required keys, array of strings) before UPDATE; reject invalid payloads and log failed IDs. |
| Writes | Supabase UPDATE on `exercises` for `instructions` only; use `.not('id', 'in', excludedIds)` and only for rows where `instructions IS NULL`. |
| Idempotency | Only set `instructions` where currently NULL; never overwrite non-null. |
| Robustness | Retry with backoff on LLM errors; log failed IDs; re-run is idempotent. |

### Config and env

- Read LLM endpoint and key (or template choice) from [file:scripts/enrichment-config.ts](scripts/enrichment-config.ts) or env.
- Env: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` required; LLM or inference API key if used.

### JSONB shape

- Same shape as in [file:supabase/seed.sql](supabase/seed.sql) and consumed by [file:src/components/exercise/ExerciseInstructionsPanel.tsx](src/components/exercise/ExerciseInstructionsPanel.tsx) and [file:src/components/exercise/ExerciseInfoDialog.tsx](src/components/exercise/ExerciseInfoDialog.tsx): `{ setup: string[], movement: string[], breathing: string[], common_mistakes: string[] }`.

### File responsibility

| File | Purpose |
|------|--------|
| `scripts/enrich-instructions.ts` | Batch: candidates, generate instructions (LLM or template), validate shape, UPDATE `instructions`. Idempotent. |

## Out of Scope

- Phase 1 (YouTube) and Phase 2 (illustrations); no changes to `youtube_url` or `image_url`.
- Schema or UI changes.
- `--force` flag to overwrite existing non-null `instructions` (v1 idempotent only).
- Instructions in any language other than French for this ticket.

## Acceptance Criteria

- [ ] `scripts/enrich-instructions.ts` runs with `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and (if used) LLM/inference API key set.
- [ ] Only rows with `instructions IS NULL` and `id` not in the exclusion set are updated; no row in the 23 is ever updated.
- [ ] Generated `instructions` are French and have the exact JSONB shape: `setup`, `movement`, `breathing`, `common_mistakes` (each string[]).
- [ ] Invalid or malformed payloads are not written; failed IDs are logged; validation runs before UPDATE.
- [ ] Re-running the script after some rows have been filled does not overwrite existing `instructions` (idempotent).
- [ ] On LLM or API failure, script retries with backoff, logs failed IDs, and may exit with partial progress; re-run is safe.

## References

- [Epic Brief — Exercise Content Enrichment](Epic_Brief_—_Exercise_Content_Enrichment.md) — Phase 3 (instructions) is out of Epic scope; this ticket follows the Tech Plan.
- [Tech Plan — Exercise Content Enrichment](Tech_Plan_—_Exercise_Content_Enrichment.md) — Phase 3 decisions, instructions shape, failure modes (LLM invalid JSON).
- [T19 — Enrichment Strategy and Shared Config](T19_—_Enrichment_Strategy_and_Shared_Config.md)
- [file:supabase/seed.sql](supabase/seed.sql) — instructions shape for seed exercises.
- [file:src/components/exercise/ExerciseInstructionsPanel.tsx](src/components/exercise/ExerciseInstructionsPanel.tsx), [file:src/components/exercise/ExerciseInfoDialog.tsx](src/components/exercise/ExerciseInfoDialog.tsx) — consume `instructions`.
