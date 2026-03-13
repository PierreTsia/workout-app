# T20 — Phase 1 — YouTube Enrichment Script

## Goal

Backfill `exercises.youtube_url` for imported exercises (excluding the 23 hand-curated ones) where `youtube_url IS NULL`, using a curated channel allowlist first and YouTube Data API v3 search as fallback. The script is idempotent: re-runs do not overwrite existing non-null `youtube_url`. Language preference is FR then EN (configurable via T19 config).

## Dependencies

- **T19 — Enrichment Strategy and Shared Config.** Requires the strategy doc (prioritization order), [file:scripts/enrichment-config.ts](scripts/enrichment-config.ts) (language order, API key, allowlist path), and the exclusion-set helper so the script never updates the 23.

## Scope

### Script: enrich-youtube.ts

Create [file:scripts/enrich-youtube.ts](scripts/enrich-youtube.ts) as a Node/TS batch script following the pattern of [file:scripts/import-exercises.ts](scripts/import-exercises.ts).

| Responsibility | Detail |
|----------------|--------|
| Exclusion set | At start, resolve the 23 names from `EXISTING_EXERCISE_MAP` to exercise IDs using the T19 helper; store as `Set<string>` excludedIds. |
| Candidate query | Fetch exercises where `source` is set (imported), `youtube_url IS NULL`, and `id` not in excludedIds. Order by prioritization heuristic from strategy (estimated popularity: compound movements, common names, then muscle group/equipment). |
| Per exercise | Lookup allowlist by name/name_en; if found, use that URL. If not, call YouTube Data API v3 search (FR then EN per config). Set `youtube_url` to full YouTube URL. |
| Writes | Supabase UPDATE on `exercises` for `youtube_url` only; use `.not('id', 'in', excludedIds)` and only for rows where `youtube_url IS NULL`. |
| Idempotency | Only set `youtube_url` where currently NULL; never overwrite non-null. |
| Robustness | Retries and batching per quota; log failures and skipped IDs. |

### Config and env

- Read language order, YouTube API key, and allowlist path from [file:scripts/enrichment-config.ts](scripts/enrichment-config.ts) or env (e.g. `YOUTUBE_API_KEY`).
- Env: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` required; YouTube API key required for API fallback when allowlist misses.

### Allowlist

- Allowlist format (CSV/JSON) and path are configurable; script loads it and matches by exercise name/name_en to get a pre-approved video URL. If no match, fall back to API search.

### File responsibility

| File | Purpose |
|------|--------|
| `scripts/enrich-youtube.ts` | Batch: load candidates, allowlist then API, UPDATE `youtube_url`. Idempotent. |

## Out of Scope

- Phase 2 (illustrations) and Phase 3 (instructions); no changes to `image_url` or `instructions`.
- Schema or UI changes.
- `--force` flag to overwrite existing non-null `youtube_url` (v1 idempotent only).
- Deduplication of the same video ID across exercises (acceptable per Tech Plan).

## Acceptance Criteria

- [ ] `scripts/enrich-youtube.ts` runs with `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and (for API fallback) YouTube API key set.
- [ ] Only rows with `youtube_url IS NULL` and `id` not in the exclusion set are updated; no row in the 23 (by name in EXISTING_EXERCISE_MAP) is ever updated.
- [ ] For each candidate, allowlist is consulted first; if no match, YouTube Data API v3 search is used (FR then EN per config).
- [ ] Re-running the script after some rows have been filled does not overwrite existing `youtube_url` (idempotent).
- [ ] Failures (e.g. API quota, network) are logged; script can exit with partial progress and be re-run safely.
- [ ] Candidate list is ordered by the prioritization heuristic defined in the strategy (T19).

## References

- [Epic Brief — Exercise Content Enrichment](Epic_Brief_—_Exercise_Content_Enrichment.md)
- [Tech Plan — Exercise Content Enrichment](Tech_Plan_—_Exercise_Content_Enrichment.md) — Phase 1 decisions, idempotency, exclusion set, failure modes (YouTube API quota).
- [T19 — Enrichment Strategy and Shared Config](T19_—_Enrichment_Strategy_and_Shared_Config.md)
