import { describe, it, expect } from "vitest"

/**
 * ADR 0033: the Deload trigger reads the last N sessions of a slot through a
 * dedicated read RPC. This sweeps the migrations and refuses a regression that
 * drops the function, widens its privileges, or lets the window bound slip
 * *after* the ranking (which would count the live session).
 *
 * It proves the *signal* is present, not that the SQL is correct — judging that
 * stays a human job, and a real call is what catches a plpgsql error.
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
const defining = sorted.filter(({ sql }) =>
  /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(public\.)?get_slot_prescription_history/i.test(
    sql,
  ),
)
const rpc = defining.at(-1)

describe("get_slot_prescription_history migration (ADR 0033)", () => {
  it("creates the function, without dropping an existing one", () => {
    expect(rpc).toBeDefined()
    expect(
      sorted.some(({ sql }) =>
        /DROP\s+FUNCTION[^;]*get_slot_prescription_history/i.test(sql),
      ),
    ).toBe(false)
  })

  it("runs SECURITY INVOKER, so the caller's RLS applies", () => {
    expect(rpc!.sql).toMatch(/SECURITY\s+INVOKER/i)
    expect(rpc!.sql).not.toMatch(/SECURITY\s+DEFINER/i)
  })

  it("is granted to authenticated", () => {
    expect(rpc!.sql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(public\.)?get_slot_prescription_history\s*\([^)]*\)\s+TO\s+authenticated/i,
    )
  })

  it("scopes every row to the caller", () => {
    expect(rpc!.sql).toMatch(/s\.user_id\s*=\s*auth\.uid\(\)/i)
  })

  it("excludes the duration axis and the pristine-less rows", () => {
    expect(rpc!.sql).toMatch(/sl\.duration_seconds\s+IS\s+NULL/i)
    expect(rpc!.sql).toMatch(/sl\.prescribed_reps\s+IS\s+NOT\s+NULL/i)
  })

  it("aliases the projected and ranking columns, so RETURNS TABLE names cannot shadow them", () => {
    expect(rpc!.sql).toMatch(/AS\s+we_id/i)
    expect(rpc!.sql).toMatch(/AS\s+ex_id/i)
    expect(rpc!.sql).toMatch(/AS\s+sess_id/i)
    expect(rpc!.sql).toMatch(/PARTITION\s+BY\s+per_session\.we_id,\s*per_session\.ex_id/i)
  })

  it("bounds the window before the ranking limit, so the live session is never counted", () => {
    const bound = rpc!.sql.search(/last_logged_at\s*<\s*p_before/i)
    const limit = rpc!.sql.search(/rn\s*<=\s*p_limit/i)

    expect(bound).toBeGreaterThan(-1)
    expect(limit).toBeGreaterThan(-1)
    expect(bound).toBeLessThan(limit)
  })
})
