# T21 — Phase 2 — Illustration Enrichment Script

## Goal

Backfill `exercises.image_url` for imported exercises (excluding the 23 hand-curated ones) where `image_url IS NULL`, by generating one illustration per exercise with explicit diversity constraints (gender balance, ethnic diversity, body types), uploading to the existing Supabase `exercise-media` bucket, and setting `image_url` to the object path. The script is idempotent: re-runs do not overwrite existing non-null `image_url`. Style is aligned to the existing 23 (static, clear form, minimal background).

## Dependencies

- **T19 — Enrichment Strategy and Shared Config.** Requires the strategy doc (prioritization order), [file:scripts/enrichment-config.ts](scripts/enrichment-config.ts) (image provider, model, style and diversity params), and the exclusion-set helper so the script never updates the 23.

## Scope

### Script: enrich-illustrations.ts

Create [file:scripts/enrich-illustrations.ts](scripts/enrich-illustrations.ts) as a Node/TS batch script following the pattern of [file:scripts/import-exercises.ts](scripts/import-exercises.ts).

| Responsibility | Detail |
|----------------|--------|
| Exclusion set | At start, resolve the 23 names to exercise IDs using the T19 helper; store as `Set<string>` excludedIds. |
| Candidate query | Fetch exercises where `image_url IS NULL` and `id` not in excludedIds (imported). Order by same prioritization heuristic as Phase 1 (from strategy). |
| Per exercise | Build prompt with diversity variant (round-robin or deterministic) to ensure gender and ethnic balance across the illustrated set. Call Replicate or Hugging Face Inference (single choice per Tech Plan); use negative prompt to minimise artifacts. |
| Upload | Upload image buffer to `exercise-media` bucket via Supabase Storage (using `SUPABASE_SERVICE_ROLE_KEY`). Object path = stable slug (e.g. `{exercise-id}.png` or `{slug}.png`). |
| Writes | Supabase UPDATE on `exercises` for `image_url` only (relative path in bucket); use `.not('id', 'in', excludedIds)` and only for rows where `image_url IS NULL`. |
| Idempotency | Only set `image_url` where currently NULL; never overwrite non-null. |
| Robustness | Retry with backoff on provider errors; log failed IDs; script may exit with partial progress; re-run is idempotent. |

### Config and env

- Read image provider, model, style, and diversity params from [file:scripts/enrichment-config.ts](scripts/enrichment-config.ts) or env.
- Env: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` required; API key for Replicate or Hugging Face as applicable.

### Diversity

- Explicit prompt constraints and variant selection (e.g. round-robin) so the illustrated set has gender balance (~50/50) and varied skin tones and body types. Document in strategy or in script comments.

### Reuse (optional)

- Duplicate images are acceptable for very close exercises (e.g. “Bench Press” variants). Optionally reuse one image per exercise family (slug derived from base name); otherwise one image per exercise.

### File responsibility

| File | Purpose |
|------|--------|
| `scripts/enrich-illustrations.ts` | Batch: candidates, generate image (diversity variant), upload to `exercise-media`, UPDATE `image_url`. Idempotent. |

## Out of Scope

- Phase 1 (YouTube) and Phase 3 (instructions); no changes to `youtube_url` or `instructions`.
- Schema or UI changes.
- `--force` flag to overwrite existing non-null `image_url` (v1 idempotent only).
- Animated illustrations (static only for v1).

## Acceptance Criteria

- [ ] `scripts/enrich-illustrations.ts` runs with `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and image-provider API key set.
- [ ] Only rows with `image_url IS NULL` and `id` not in the exclusion set are updated; no row in the 23 is ever updated.
- [ ] Generated images are uploaded to the existing `exercise-media` bucket; `image_url` is set to the object path (e.g. `{slug}.png`) so that [file:src/lib/storage.ts](src/lib/storage.ts) builds the correct public URL.
- [ ] Prompts and variant selection enforce diversity (gender balance, ethnic diversity, body types) across the illustrated set.
- [ ] Re-running the script after some rows have been filled does not overwrite existing `image_url` (idempotent).
- [ ] On provider rate limit or error, script retries with backoff, logs failed IDs, and may exit with partial progress; re-run is safe.

## References

- [Epic Brief — Exercise Content Enrichment](Epic_Brief_—_Exercise_Content_Enrichment.md)
- [Tech Plan — Exercise Content Enrichment](Tech_Plan_—_Exercise_Content_Enrichment.md) — Phase 2 decisions, upload target, diversity, failure modes (image provider rate limit).
- [T19 — Enrichment Strategy and Shared Config](T19_—_Enrichment_Strategy_and_Shared_Config.md)
- [file:src/lib/storage.ts](src/lib/storage.ts) — builds public URL from `image_url` path.
