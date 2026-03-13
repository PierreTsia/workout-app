# Enrichment Strategy — Exercise Content

Single source for enrichment strategy and shared configuration used by Phase 1–3 scripts (YouTube, illustrations, instructions). Defines prioritization, coverage targets, quota/cost, deduplication/reuse, and future-run policy.

---

## Prioritization

Phase scripts process **candidates** (imported exercises with `youtube_url` / `image_url` / `instructions` IS NULL, excluding the 23 hand-curated exercises) in a deterministic order based on **estimated popularity**. No usage analytics exist yet; ordering is heuristic and repeatable.

**Ordering used by phase scripts:**

1. **Compound movements first** — Multi-joint exercises (squat, deadlift, bench press, row, overhead press) are assumed to be the most used. Identified by name patterns (e.g. containing “squat”, “deadlift”, “bench”, “row”, “press”, “développé”, “soulevé”, “tirage”, “presse”) and/or primary muscle groups that typically indicate compounds.
2. **Common names** — Exercises whose `name` or `name_en` matches high-frequency terms: squat, bench, deadlift, row, curl, extension, pull-down, leg press, lunge, etc.
3. **Muscle group / equipment** — Remaining candidates ordered by muscle group (e.g. Pectoraux, Dos, Quadriceps, …) then by equipment (barbell, dumbbell, machine, …) for predictable batching.

This ordering is implemented in each phase script when fetching the candidate set; the strategy doc does not mandate a specific sort key (e.g. a single “priority” column) to avoid schema change. Scripts may use a SQL `ORDER BY` expression or in-memory sort based on the above rules.

---

## Coverage Targets

| Target | Definition | Goal |
|--------|------------|------|
| **YouTube (Phase 1)** | Among **all imported** exercises (those with `source` set, excluding the 23), the proportion with non-null `youtube_url`. | ≥ 80% of that subset. Allowlist + API fallback are used to maximise coverage; some exercises may have no suitable video. |
| **Images (Phase 2)** | Same subset: proportion with non-null `image_url`. | ≥ 80%. One image per exercise (or per exercise family when reuse is applied). |
| **Instructions (Phase 3)** | Same subset: proportion with non-null `instructions` (JSONB). | ≥ 80%. French; same shape as seed (setup, movement, breathing, common_mistakes). |

“All imported” = `exercises` where `source IS NOT NULL` and `id` not in the exclusion set (the 23 names from [file:scripts/exercise-mapping.ts](scripts/exercise-mapping.ts)). Tier 1 is not formally defined as a DB column; if a script introduces a “Tier 1” subset (e.g. first N by prioritization), the 80% target can apply to that subset instead, and must be documented in the script or this doc.

---

## Quota and Cost

| Resource | Limit / approach | Notes |
|----------|------------------|--------|
| **YouTube Data API v3** | Default daily quota (e.g. 10,000 units); search uses units per request. | Phase 1 uses a **curated channel allowlist** (CSV/JSON) first to avoid consuming quota for known-good demos; API search is fallback. If quota is exceeded, script logs and stops; re-run next day or in batches. |
| **Image generation** | Free tier: Replicate or Hugging Face Inference. Rate limits and optional batching (e.g. N per minute). | No new DB columns. Batch size and delay are configurable in [file:scripts/enrichment-config.ts](scripts/enrichment-config.ts). |
| **LLM (Phase 3)** | Free tier (e.g. Hugging Face Inference) or template-only. | Rate limits and retries; no new DB columns. |

---

## Deduplication / Reuse

| Content | Rule |
|---------|------|
| **Videos** | One video per exercise by default. Reusing the **same video URL** for multiple exercises in the same “family” (e.g. “Bench Press” variants) is acceptable and reduces API usage. Allowlist can map a family key to one URL. |
| **Images** | One image per exercise by default. **Reuse of one image per exercise family** (e.g. same illustration for “Bench Press” and “Bench Press Incliné”) is acceptable; style and diversity constraints still apply to the set of unique images. |

What counts as “family” is implementation-defined (e.g. slug prefix or canonical name); document in the phase script or here if needed.

---

## Future Runs

| Scenario | Approach |
|----------|----------|
| **New exercises (Wger sync or manual add)** | Run the same phase scripts **on-demand** after import (e.g. `npm run enrich-youtube`). Candidates are “where column IS NULL and not in exclusion set”; new rows are picked up automatically. |
| **Scheduled batch** | Optional: schedule (e.g. weekly) a job that runs Phase 1–3 for all candidates; idempotent, so safe to re-run. |
| **Manual** | For one-off exercises or fixes, run the relevant script or update DB manually. |

No schema or config change required for “future” exercises; the exclusion set is based on the 23 **names** in [file:scripts/exercise-mapping.ts](scripts/exercise-mapping.ts). If a curated exercise is renamed in the app, the mapping must be updated so it remains in the exclusion set.

---

## References

- [Epic Brief — Exercise Content Enrichment](Epic_Brief_—_Exercise_Content_Enrichment.md)
- [Tech Plan — Exercise Content Enrichment](Tech_Plan_—_Exercise_Content_Enrichment.md)
- [T19 — Enrichment Strategy and Shared Config](T19_—_Enrichment_Strategy_and_Shared_Config.md)
