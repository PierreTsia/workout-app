import { describe, it, expect } from "vitest"

/**
 * T266 / ADR 0026: the deviation reason lives in its own table, scoped to its
 * owner. The "why" must never leak across accounts — this sweeps the migration
 * that creates it and refuses an un-scoped table or a `kind` that drifts past
 * the v1 scope (`load_deviation` only; other kinds are one-line migrations).
 *
 * It proves a scoping *signal* is present (`auth.uid() = user_id`), not that
 * the policy is correct — judging that stays a human job.
 */
const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

/** Line comments only — the migration directory has no block comments. */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, "")

const migration = Object.entries(migrationSources).find(([path]) =>
  path.includes("session_deviation_events"),
)

const sql = stripComments(migration?.[1] ?? "")

const kindsIn = (source: string): string[] => {
  const list = /kind\s+text[^;]*?CHECK\s*\(\s*kind\s+IN\s*\(([^)]*)\)\s*\)/i.exec(
    source,
  )?.[1]
  if (!list) return []
  return [...list.matchAll(/'([^']+)'/g)].map(([, value]) => value)
}

describe("session_deviation_events migration (T266)", () => {
  it("ships the migration", () => {
    expect(migration).toBeDefined()
  })

  it("enables RLS and scopes every row to its owner", () => {
    expect(sql).toMatch(
      /ALTER TABLE session_deviation_events ENABLE ROW LEVEL SECURITY/i,
    )
    expect(sql).toMatch(
      /CREATE POLICY[\s\S]*?ON session_deviation_events[\s\S]*?auth\.uid\(\)\s*=\s*user_id/i,
    )
    expect(sql).toMatch(/user_id uuid NOT NULL DEFAULT auth\.uid\(\)/i)
  })

  it("session-scopes the policy, not just user_id", () => {
    // A caller-controlled user_id is not enough: the FK target must belong to
    // the caller too, or an event can reference another account's session.
    expect(sql).toMatch(
      /EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sessions\s+\w+\s+WHERE\s+\w+\.id\s*=\s*session_id\s+AND\s+\w+\.user_id\s*=\s*auth\.uid\(\)\s*\)/i,
    )
  })

  it("admits only load_deviation as a kind in v1", () => {
    expect(kindsIn(sql)).toEqual(["load_deviation"])
  })

  it("adds the optional session note column", () => {
    expect(sql).toMatch(/ALTER TABLE sessions ADD COLUMN session_note text/i)
  })
})
