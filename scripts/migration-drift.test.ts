import { describe, expect, it } from "vitest"
import {
  compareMigrationVersions,
  redactDbUrl,
  requireDbUrl,
} from "./migration-drift.js"

describe("compareMigrationVersions", () => {
  it("reports nothing when the repo and the database agree", () => {
    expect(compareMigrationVersions(["1", "2"], ["1", "2"])).toEqual({
      remoteOnly: [],
      localOnly: [],
    })
  })

  it("names a version applied in the database but absent from the repo", () => {
    expect(compareMigrationVersions(["1"], ["1", "19990101000000"])).toEqual({
      remoteOnly: ["19990101000000"],
      localOnly: [],
    })
  })

  it("reports repo-only versions without calling them drift", () => {
    expect(compareMigrationVersions(["1", "2"], ["1"])).toEqual({
      remoteOnly: [],
      localOnly: ["2"],
    })
  })

  it("sorts both sides so the output is stable", () => {
    expect(compareMigrationVersions(["3", "1"], ["4", "2"])).toEqual({
      remoteOnly: ["2", "4"],
      localOnly: ["1", "3"],
    })
  })
})

describe("redactDbUrl", () => {
  it("keeps the host and database name", () => {
    expect(
      redactDbUrl("postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    ).toBe("127.0.0.1:54322/postgres")
  })

  it("drops the userinfo so the password never reaches stdout", () => {
    const redacted = redactDbUrl(
      "postgresql://postgres:s3cr3t@db.favusepjqwpcroiolvaz.supabase.co:5432/postgres",
    )
    expect(redacted).toBe("db.favusepjqwpcroiolvaz.supabase.co:5432/postgres")
    expect(redacted).not.toContain("s3cr3t")
    expect(redacted).not.toContain("postgres:")
  })

  it("drops query parameters", () => {
    expect(
      redactDbUrl("postgresql://u:p@host:5432/postgres?sslmode=require&x=1"),
    ).toBe("host:5432/postgres")
  })

  it("does not throw on an unparseable URL", () => {
    expect(redactDbUrl("not a url")).toBe("<URL illisible>")
  })
})

describe("requireDbUrl", () => {
  it("returns the URL when SUPABASE_DB_URL is set", () => {
    expect(requireDbUrl({ SUPABASE_DB_URL: "postgresql://h/db" })).toBe(
      "postgresql://h/db",
    )
  })

  it("refuses to fall back to localhost when the URL is missing", () => {
    expect(() => requireDbUrl({})).toThrow(/SUPABASE_DB_URL/)
  })
})
