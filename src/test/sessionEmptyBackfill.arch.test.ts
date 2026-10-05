import { describe, it, expect } from "vitest"

/**
 * #654 follow-up — backfill of the rows the pre-fix finish path left behind.
 *
 *   1. Finished sessions with zero set_logs are deleted (the old finish had no
 *      zero-set guard). The predicate must also spare any session that logged a
 *      circuit through `block_runs`.
 *   2. `active_duration_ms` inflated past 12 h by the old wall-clock path
 *      (pre-#655) is recomputed as last set − first set, like the #568 backfill.
 *
 * Like the other arch tests, this proves the guards are *present*, not that the
 * migration is *correct* — applying it stays a human job.
 */
const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

/** Line comments only — the migration directory has no block comments. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, "")

const migration = Object.entries(migrationSources).find(([path]) =>
  path.includes("session_empty_backfill"),
)

const sql = stripComments(migration?.[1] ?? "")

const gapMigration = Object.entries(migrationSources).find(([path]) =>
  path.includes("session_duration_gap_backfill"),
)

const gapSql = stripComments(gapMigration?.[1] ?? "")

const orphanMigration = Object.entries(migrationSources).find(([path]) =>
  path.includes("close_stale_orphan_sessions"),
)

const orphanSql = stripComments(orphanMigration?.[1] ?? "")

describe("session empty backfill migration (#654 follow-up)", () => {
  it("ships the migration", () => {
    expect(migration).toBeDefined()
  })

  it("deletes finished sessions that have no set_logs", () => {
    expect(sql).toMatch(
      /DELETE FROM public\.sessions\s+s\s+WHERE s\.finished_at IS NOT NULL/i,
    )
    expect(sql).toMatch(
      /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.set_logs sl WHERE sl\.session_id = s\.id\s*\)/i,
    )
  })

  it("spares sessions that logged a circuit through block_runs", () => {
    expect(sql).toMatch(
      /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.block_runs br WHERE br\.session_id = s\.id\s*\)/i,
    )
  })

  it("recomputes inflated active_duration_ms as last set − first set", () => {
    expect(sql).toMatch(
      /UPDATE public\.sessions s\s+SET active_duration_ms = GREATEST\(\s*0,\s*\(/i,
    )
    expect(sql).toMatch(
      /EXTRACT\(EPOCH FROM \(MAX\(sl\.logged_at\) - MIN\(sl\.logged_at\)\)\)/i,
    )
  })

  it("only touches durations over the 12 h ceiling, with at least two sets", () => {
    expect(sql).toMatch(
      /s\.active_duration_ms > 12 \* 60 \* 60 \* 1000/i,
    )
    expect(sql).toMatch(/\) >= 2/i)
  })
})

describe("session duration gap backfill migration (#654 follow-up)", () => {
  it("ships the migration", () => {
    expect(gapMigration).toBeDefined()
  })

  it("measures gaps between consecutive sets with LAG", () => {
    expect(gapSql).toMatch(
      /LAG\(sl\.logged_at\) OVER \(PARTITION BY sl\.session_id ORDER BY sl\.logged_at\)/i,
    )
  })

  it("subtracts every gap longer than 3 h from the span", () => {
    expect(gapSql).toMatch(/WHERE gap > interval '3 hours'/i)
    expect(gapSql).toMatch(/sp\.span_ms - COALESCE\(bg\.gap_ms, 0\)/i)
  })

  it("stays scoped to rows still over the 12 h ceiling", () => {
    expect(gapSql).toMatch(
      /s\.active_duration_ms > 12 \* 60 \* 60 \* 1000/i,
    )
  })
})

describe("close stale orphan sessions backfill (#654 follow-up)", () => {
  it("ships the migration", () => {
    expect(orphanMigration).toBeDefined()
  })

  it("closes only still-open sessions idle beyond the 3 h threshold", () => {
    expect(orphanSql).toMatch(/s\.finished_at IS NULL/i)
    expect(orphanSql).toMatch(/interval '3 hours'/i)
  })

  it("writes the last set as finished_at, the set count, and last − first", () => {
    expect(orphanSql).toMatch(/MAX\(sl\.logged_at\) AS finished_at/i)
    expect(orphanSql).toMatch(/COUNT\(\*\) AS total_sets_done/i)
    expect(orphanSql).toMatch(
      /EXTRACT\(EPOCH FROM \(MAX\(sl\.logged_at\) - MIN\(sl\.logged_at\)\)\)/i,
    )
  })
})
