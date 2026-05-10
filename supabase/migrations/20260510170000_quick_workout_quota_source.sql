-- Extend ai_generation_log.source CHECK to cover the `quick_workout` quota
-- introduced by epic #342. Pattern parity with the embedded-agent migration
-- 20260508155714 — same DROP / ADD shape, no backfill, no index change.
--
-- The legacy `'workout'` value stays so historical rows from the soon-to-die
-- `generate-workout` function keep their attribution. Once #343 retires
-- `generate-program`, a follow-up migration can prune both `'program'` and
-- `'workout'` from the union.

alter table ai_generation_log
  drop constraint chk_ai_generation_log_source;

alter table ai_generation_log
  add constraint chk_ai_generation_log_source
  check (source in ('program','workout','embedded_chat','embedded_draft','quick_workout'));
