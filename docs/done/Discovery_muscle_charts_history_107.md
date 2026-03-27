# Discovery — muscle charts & History (#107)

Follow-up from the History revamp epic ([issue #107](https://github.com/PierreTsia/workout-app/issues/107)): **muscle-group / volume-over-time charts** are intentionally out of scope for v1 of the Activity tab (calendar, heatmap, monthly aggregates).

## What to validate before implementation

1. **Data source** — whether charts should reuse `get_training_activity_by_day`–style buckets, per-session muscle tags from set logs, or a dedicated aggregation RPC (avoid N+1 client-side rollups on large histories).
2. **UX placement** — new sub-tab under History vs. a collapsible block under Activity vs. a post-workout insight surface; keep parity with EN/FR copy.
3. **Performance budget** — cap date range and downsampling for any time series rendered on mobile (PWA).

This note is a stub for product/engineering discovery; implementation tickets should reference the outcome here.
