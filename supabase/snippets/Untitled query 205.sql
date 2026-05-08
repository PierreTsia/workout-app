select
  conname,
  case confdeltype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
  end as on_delete
from pg_constraint
where conrelid = 'embedded_agent_threads'::regclass and contype = 'f';

select pg_get_constraintdef(oid) as check_def
from pg_constraint
where conname = 'chk_ai_generation_log_source';