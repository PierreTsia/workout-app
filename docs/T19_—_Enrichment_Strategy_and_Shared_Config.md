# T19 — Enrichment Strategy and Shared Config

## Goal

Deliver the single source for enrichment strategy and shared configuration so Phase 1–3 scripts (T20, T21, T22) can run without ad-hoc env or duplicated exclusion logic. This ticket documents prioritization, coverage targets, quota/cost, deduplication/reuse, and future-run policy, and provides a config module plus a helper to resolve the 23 hand-curated exercise names to DB IDs for exclusion in all phase scripts.

## Dependencies

None. Existing codebase: [file:scripts/exercise-mapping.ts](scripts/exercise-mapping.ts) (EXISTING_EXERCISE_MAP), [file:scripts/import-exercises.ts](scripts/import-exercises.ts) (pattern for Node/TS scripts and Supabase usage).

## Scope

### Strategy document

Add a strategy section to the Tech Plan or a standalone doc (e.g. `docs/Enrichment_Strategy.md`) defining:

| Topic | Content |
|-------|--------|
| Prioritization | Estimated popularity heuristic: compound movements first, common names (squat, bench, deadlift, row), then muscle group/equipment. Document the ordering used by phase scripts. |
| Coverage targets | Whether e.g. ≥80% applies to “all imported”, “Tier 1 only”, or a defined subset; same for YouTube and images. |
| Quota and cost | YouTube Data API v3 daily quota and allowlist fallback; image generation rate limits and batching rules; no new DB columns. |
| Deduplication / reuse | Rules for reusing one video or one image per exercise family (e.g. “Bench Press” variants); document what is acceptable. |
| Future runs | How new exercises (future Wger sync or manual add) get enriched: same script on-demand, scheduled batch, or manual. |

### Enrichment config module

Create [file:scripts/enrichment-config.ts](scripts/enrichment-config.ts) that centralises or re-exports (from env where appropriate):

| Concern | Detail |
|---------|--------|
| Phase 1 | Language order (FR then EN, configurable), YouTube API key, allowlist path (CSV/JSON). |
| Phase 2 | Image provider (Replicate or Hugging Face Inference), model, style and diversity params. |
| Phase 3 | LLM endpoint and key (if used) or template choice. |
| Env | Scripts expect `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; Phase 1 may use `YOUTUBE_API_KEY`; Phase 2/3 their respective keys. |

Config is read by phase scripts via this module or env; no phase script logic in T19.

### Exclusion-set helper

Implement a helper (in enrichment-config or a small shared module) that:

1. Loads the 23 exercise **names** (keys of `EXISTING_EXERCISE_MAP`) from [file:scripts/exercise-mapping.ts](scripts/exercise-mapping.ts).
2. Queries Supabase `exercises` for `id` where `name IN (...)` (using the same Supabase client pattern as [file:scripts/import-exercises.ts](scripts/import-exercises.ts)).
3. Returns a `Set<string>` of exercise IDs to exclude from any enrichment UPDATE.

Every phase script will use this set so that no UPDATE touches the 23 hand-curated rows. Contract: the 23-name list in exercise-mapping is the source of truth; if a curated exercise is renamed in the app, the mapping must be updated.

### File responsibility

| File | Purpose |
|------|--------|
| `docs/Enrichment_Strategy.md` or Tech Plan section | Prioritization, coverage, quota/cost, deduplication/reuse, future-run policy. |
| `scripts/enrichment-config.ts` | Config (language order, API keys, allowlist path, image/LLM config) and exclusion-set helper. |

## Out of Scope

- Any YouTube, image, or LLM API calls.
- Implementation of [file:scripts/enrich-youtube.ts](scripts/enrich-youtube.ts), [file:scripts/enrich-illustrations.ts](scripts/enrich-illustrations.ts), or [file:scripts/enrich-instructions.ts](scripts/enrich-instructions.ts) (those are T20, T21, T22).
- Schema or UI changes.
- `--force` or re-enrich overwrite of non-null values (v1 is idempotent only).

## Acceptance Criteria

- [ ] Strategy is documented (prioritization heuristic, coverage targets, quota/cost, deduplication/reuse, future runs) in a dedicated section or doc.
- [ ] `scripts/enrichment-config.ts` exists and exports config used by phase scripts (language order, API keys, allowlist path, image/LLM config as applicable).
- [ ] Exclusion-set helper is implemented: given Supabase client, returns `Set<string>` of exercise IDs whose names are in `EXISTING_EXERCISE_MAP`.
- [ ] Helper is unit-testable or verified: for a test DB or mock, excluded IDs match the 23 names from exercise-mapping.
- [ ] No phase script logic (YouTube, image generation, or instructions generation) is implemented in this ticket.

## References

- [Epic Brief — Exercise Content Enrichment](Epic_Brief_—_Exercise_Content_Enrichment.md)
- [Tech Plan — Exercise Content Enrichment](Tech_Plan_—_Exercise_Content_Enrichment.md) — Key Decisions, Critical Constraints, Component Architecture (Strategy doc, enrichment-config.ts, exclusion set).
