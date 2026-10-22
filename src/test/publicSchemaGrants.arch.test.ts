import { describe, it, expect } from "vitest"

/**
 * #712: a fresh `supabase db reset` left the public schema unusable — the
 * current CLI bootstrap no longer grants the classic project privileges, and
 * none of the repo's migrations ever granted them at the table level. A
 * database rebuilt from migrations had `anon`/`authenticated`/`service_role`
 * with DELETE/TRUNCATE/REFERENCES but no SELECT/INSERT/UPDATE, so the app could
 * not read or write. Prod only works because it was built by older CLI versions
 * that granted everything.
 *
 * This pins the fix: one migration must grant the three roles access to the
 * public schema's tables and sequences, and set the matching default privileges
 * so the next table-creating migration does not reopen the gap. Routines are
 * deliberately excluded from `anon` — see the SECURITY DEFINER suite, which
 * refuses any EXECUTE grant to `anon`.
 */

const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const grantsMigration = Object.entries(migrationSources).find(([path]) =>
  path.includes("grant_public_schema_privileges"),
)

const sql = (grantsMigration?.[1] ?? "").replace(/--[^\n]*/g, "")

const ROLES = "anon, authenticated, service_role"

describe("public schema grants migration (#712)", () => {
  it("ships the grants migration", () => {
    expect(grantsMigration).toBeDefined()
  })

  it("grants usage on the public schema to the three roles", () => {
    expect(sql).toMatch(
      new RegExp(
        `GRANT\\s+USAGE\\s+ON\\s+SCHEMA\\s+public\\s+TO\\s+${ROLES}\\s*;`,
        "i",
      ),
    )
  })

  it("grants all on every public table and sequence to the three roles", () => {
    expect(sql).toMatch(
      new RegExp(
        `GRANT\\s+ALL\\s+ON\\s+ALL\\s+TABLES\\s+IN\\s+SCHEMA\\s+public\\s+TO\\s+${ROLES}\\s*;`,
        "i",
      ),
    )
    expect(sql).toMatch(
      new RegExp(
        `GRANT\\s+ALL\\s+ON\\s+ALL\\s+SEQUENCES\\s+IN\\s+SCHEMA\\s+public\\s+TO\\s+${ROLES}\\s*;`,
        "i",
      ),
    )
  })

  it("sets default privileges so future tables and sequences stay granted", () => {
    expect(sql).toMatch(
      new RegExp(
        `ALTER\\s+DEFAULT\\s+PRIVILEGES\\s+FOR\\s+ROLE\\s+postgres\\s+IN\\s+SCHEMA\\s+public\\s+GRANT\\s+ALL\\s+ON\\s+TABLES\\s+TO\\s+${ROLES}\\s*;`,
        "i",
      ),
    )
    expect(sql).toMatch(
      new RegExp(
        `ALTER\\s+DEFAULT\\s+PRIVILEGES\\s+FOR\\s+ROLE\\s+postgres\\s+IN\\s+SCHEMA\\s+public\\s+GRANT\\s+ALL\\s+ON\\s+SEQUENCES\\s+TO\\s+${ROLES}\\s*;`,
        "i",
      ),
    )
  })
})
