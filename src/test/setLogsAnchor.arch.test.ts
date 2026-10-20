import { describe, it, expect } from "vitest"

/**
 * ADR 0032: the progression anchor rides `set_logs.anchor_reps`, a column of its
 * own — never an overwrite of the pristine `prescribed_*` snapshot (the
 * deviations observatory's baseline). This sweeps the migrations and refuses a
 * regression that drops the column or hides it from the Last Performance reader.
 *
 * It proves the *signal* is present, not that the SQL is correct — judging that
 * stays a human job.
 */
const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

/** Line comments only — the migration directory has no block comments. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, "")

const sorted = Object.entries(migrationSources)
  .map(([path, source]) => ({ path, sql: stripComments(source) }))
  .sort((a, b) => a.path.localeCompare(b.path))

/** Last-wins: the highest-numbered migration that (re)defines the function. */
const lastDefining = sorted.filter(({ sql }) =>
  /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(public\.)?get_last_performance_for_slots/i.test(
    sql,
  ),
)
const rpc = lastDefining.at(-1)

describe("progression anchor migration (ADR 0032)", () => {
  it("adds a nullable anchor_reps integer column to set_logs", () => {
    const adds = sorted.filter(({ sql }) =>
      /ALTER\s+TABLE\s+(public\.)?set_logs\s+ADD\s+COLUMN\s+anchor_reps\s+integer/i.test(
        sql,
      ),
    )
    expect(adds.length).toBeGreaterThan(0)
  })

  it("exposes anchor_reps from the live get_last_performance_for_slots", () => {
    expect(rpc).toBeDefined()
    expect(rpc!.sql).toMatch(/anchor_reps\s+integer/i)
    expect(rpc!.sql).toMatch(/sl\.anchor_reps/i)
  })
})
