import { describe, it, expect } from "vitest"

/**
 * #654 — session finish integrity.
 *
 * Two facts the client used to own and got wrong:
 *   1. `sessions.total_sets_done` was computed from transient local state + the
 *      offline queue at finish time, so it drifted from `set_logs` both ways.
 *      `set_logs` is now the single source of truth, maintained by a trigger.
 *   2. A replayed or late `session_finish` could move `finished_at` backwards
 *      and rewrite a closed row. The BEFORE UPDATE trigger keeps the latest close.
 *
 * This sweeps the migration for those signals. Like the other arch tests, it
 * proves the guards are *present*, not that they are *correct* — that stays a
 * human job.
 */
const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

/** Line comments only — the migration directory has no block comments. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, "")

const migration = Object.entries(migrationSources).find(([path]) =>
  path.includes("session_finish_integrity"),
)

const sql = stripComments(migration?.[1] ?? "")

describe("session finish integrity migration (#654)", () => {
  it("ships the migration", () => {
    expect(migration).toBeDefined()
  })

  it("derives total_sets_done from set_logs with a row trigger", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER\s+\w+\s+AFTER INSERT OR DELETE(?: OR UPDATE)?\s+ON public\.set_logs/i,
    )
    expect(sql).toMatch(/EXECUTE FUNCTION public\.\w+/i)
  })

  it("overrides the writer's count on every session write — order-independent", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER\s+\w+\s+BEFORE INSERT OR UPDATE\s+ON public\.sessions/i,
    )
    expect(sql).toMatch(
      /NEW\.total_sets_done\s*:=\s*\(\s*SELECT COUNT\(\*\)\s+FROM public\.set_logs/i,
    )
  })

  it("recomputes the count from set_logs, scoped to the session", () => {
    expect(sql).toMatch(
      /UPDATE public\.sessions\s+s\s+SET total_sets_done\s*=\s*\(\s*SELECT COUNT\(\*\)\s+FROM public\.set_logs\s+sl\s+WHERE sl\.session_id\s*=\s*[\w.]+/i,
    )
  })

  it("backfills the rows that drifted before the trigger existed", () => {
    expect(sql).toMatch(
      /UPDATE public\.sessions\s+s\s+SET total_sets_done\s*=\s*\(\s*SELECT COUNT\(\*\)\s+FROM public\.set_logs/i,
    )
  })

  it("keeps the latest close — a replayed finish cannot move finished_at back", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER\s+\w+\s+BEFORE UPDATE\s+ON public\.sessions/i,
    )
    expect(sql).toMatch(/NEW\.finished_at\s*<\s*OLD\.finished_at/i)
    expect(sql).toMatch(/NEW\.finished_at\s*:=\s*OLD\.finished_at/i)
  })
})
