select
  conname,
  case confdeltype
    when 'a' then 'NO ACTION'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
  end as on_delete
from pg_constraint
where conrelid = 'embedded_agent_threads'::regclass and contype = 'f';