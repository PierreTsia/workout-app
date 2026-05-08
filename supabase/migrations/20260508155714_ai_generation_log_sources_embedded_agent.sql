-- Extend ai_generation_log.source CHECK to cover the Embedded Agent quotas
-- introduced by Phase B of epic #295 (T116). Keep the existing index — it
-- already covers (user_id, source, created_at desc).

alter table ai_generation_log
  drop constraint chk_ai_generation_log_source;

alter table ai_generation_log
  add constraint chk_ai_generation_log_source
  check (source in ('program','workout','embedded_chat','embedded_draft'));
