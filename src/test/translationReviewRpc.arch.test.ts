import { describe, it, expect } from "vitest"

/**
 * `get_translations_for_review` is SECURITY DEFINER and counts `set_logs`,
 * whose RLS policy is per-user. With EXECUTE granted to `authenticated` and no
 * check in the body, any signed-in user reads cross-user training volume —
 * which is exactly what shipped, and was caught in review on PR #439.
 *
 * The guard is four lines of SQL with no visible connection to the join that
 * makes it necessary, so it is precisely the kind of thing a later "simplify
 * this function" pass deletes. These assertions are the tripwire.
 */

const migrationSources = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const repoPath = (globKey: string) => globKey.slice("../../".length)

const definitions = Object.entries(migrationSources)
  .filter(([, sql]) =>
    /FUNCTION\s+get_translations_for_review\s*\(/.test(sql),
  )
  .sort(([a], [b]) => a.localeCompare(b))

const [path, sql = ""] = definitions[definitions.length - 1] ?? []

describe("get_translations_for_review", () => {
  it("is defined exactly where this guard expects it", () => {
    expect(repoPath(path ?? "")).toBe(
      "supabase/migrations/20260802150000_create_translation_review_rpc.sql",
    )
  })

  it("authorizes against admin_users inside the body", () => {
    expect(sql).toMatch(
      /auth\.jwt\(\)\s*->>\s*'email'\s+IN\s*\(\s*SELECT\s+email\s+FROM\s+admin_users\s*\)/,
    )
  })

  it("raises insufficient_privilege instead of returning an empty queue", () => {
    // Zero rows would render as "No translation left to review!" — a gate the
    // reviewer cannot tell apart from a finished job.
    expect(sql).toMatch(/RAISE EXCEPTION[^;]*ERRCODE\s*=\s*'insufficient_privilege'/s)
  })

  it("is plpgsql, which is what makes the raise possible at all", () => {
    expect(sql).toMatch(/LANGUAGE plpgsql/)
    expect(sql).not.toMatch(/LANGUAGE sql/)
  })

  it("keeps SECURITY DEFINER pinned to a fixed search_path", () => {
    expect(sql).toMatch(/SECURITY DEFINER/)
    expect(sql).toMatch(/SET search_path = public/)
  })

  it("revokes PUBLIC and never grants EXECUTE to anon", () => {
    const grantees = [
      ...sql.matchAll(
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+get_translations_for_review\(\)\s+TO\s+([^;]+);/g,
      ),
    ].flatMap(([, list]) => list.split(",").map((role) => role.trim()))

    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION get_translations_for_review\(\) FROM PUBLIC;/,
    )
    expect(grantees).toEqual(["authenticated", "service_role"])
  })
})
