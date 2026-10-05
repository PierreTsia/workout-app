-- #654 — session finish integrity.
--
-- Two derivations the client used to own and got wrong:
--
--   1. `sessions.total_sets_done` was computed at finish time from transient
--      local state plus the offline queue (src/lib/sessionFinishStats.ts), so it
--      drifted from the real `set_logs` rows both ways. `set_logs` is now the
--      single source of truth: a row trigger keeps the column in step, and the
--      client stops sending its own count (src/lib/syncService.ts).
--
--   2. A replayed or late `session_finish` could move `finished_at` backwards and
--      rewrite an already-closed row (e.g. the #568 orphan backfill). The
--      BEFORE UPDATE trigger keeps the latest close, so a stale write is a no-op
--      while a legitimate resume-after-auto-close (later timestamp) still lands.
--
-- No SECURITY DEFINER: both triggers run as the caller, who owns the row under
-- the existing "Users manage own sessions" RLS policy.

-- 1. total_sets_done derived from set_logs -------------------------------------
--
-- Two directions, deliberately: the AFTER on set_logs keeps the column correct
-- as logs stream in (and out), while the BEFORE on sessions overrides whatever
-- the writer sent. The second makes the column authoritative even if an old
-- client (still shipping its own count) writes before this ships.

CREATE OR REPLACE FUNCTION public.derive_session_total_sets_done()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.total_sets_done := (
    SELECT COUNT(*) FROM public.set_logs sl WHERE sl.session_id = NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER sessions_derive_total_sets_done
BEFORE INSERT OR UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.derive_session_total_sets_done();

CREATE OR REPLACE FUNCTION public.sync_session_total_sets_done()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_session uuid := COALESCE(NEW.session_id, OLD.session_id);
BEGIN
  UPDATE public.sessions s
  SET total_sets_done = (
    SELECT COUNT(*) FROM public.set_logs sl WHERE sl.session_id = target_session
  )
  WHERE s.id = target_session;
  RETURN NULL;
END;
$$;

CREATE TRIGGER set_logs_sync_session_total_sets_done
AFTER INSERT OR DELETE OR UPDATE ON public.set_logs
FOR EACH ROW EXECUTE FUNCTION public.sync_session_total_sets_done();

-- Backfill the rows that drifted before the trigger existed.
UPDATE public.sessions s
SET total_sets_done = (
  SELECT COUNT(*) FROM public.set_logs sl WHERE sl.session_id = s.id
);

-- 2. finished_at is monotonic (latest close wins) ------------------------------

CREATE OR REPLACE FUNCTION public.sessions_keep_latest_finish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.finished_at IS NOT NULL
     AND (NEW.finished_at IS NULL OR NEW.finished_at < OLD.finished_at) THEN
    NEW.finished_at := OLD.finished_at;
    NEW.active_duration_ms := OLD.active_duration_ms;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sessions_keep_latest_finish
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.sessions_keep_latest_finish();
