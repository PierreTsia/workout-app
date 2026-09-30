-- #568 — backfill one-shot: close the 5 known orphan sessions.
-- finished_at = last set_logs.logged_at (never now()), total_sets_done = COUNT,
-- active_duration_ms = last − first. has_skipped_sets = false (not reconstructible),
-- was_pr not recomputed. No achievement is re-credited: this does not replay
-- check_and_grant_achievements.
WITH targets AS (
  SELECT unnest(ARRAY[
    '5cd0147d-bad2-49fa-868d-a82aa980faf4',
    'a065f749-be1e-448c-8c65-7ad42811d427',
    'b6fa8e06-d6ea-428f-859a-26b1afa9b58a',
    '6295d25b-7031-4b46-be54-734b7288bf60',
    '7bcda24a-7542-4646-b325-b71fa143fc9b'
  ]::uuid[]) AS id
),
agg AS (
  SELECT
    t.id,
    MAX(sl.logged_at) AS finished_at,
    COUNT(sl.id) AS total_sets_done,
    (EXTRACT(EPOCH FROM (MAX(sl.logged_at) - MIN(sl.logged_at))) * 1000)::bigint AS active_duration_ms
  FROM targets t
  JOIN set_logs sl ON sl.session_id = t.id
  GROUP BY t.id
)
UPDATE sessions s
SET finished_at = a.finished_at,
    total_sets_done = a.total_sets_done,
    active_duration_ms = GREATEST(0, a.active_duration_ms),
    has_skipped_sets = false
FROM agg a
WHERE s.id = a.id
  AND s.finished_at IS NULL;
