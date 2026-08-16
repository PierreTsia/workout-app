import { describe, expect, it } from "vitest"

const migrationSources = import.meta.glob<string>(
  "../../supabase/migrations/*_pantheon_benchmark_seeds.sql",
  {
    query: "?raw",
    eager: true,
    import: "default",
  },
)

function readPantheonMigration(): string {
  const migrations = Object.values(migrationSources)
  expect(migrations).toHaveLength(1)
  return migrations[0] ?? ""
}

describe("Pantheon benchmark seed migration", () => {
  it("seeds all eight locked Pantheon labels", () => {
    const sql = readPantheonMigration()
    expect(sql).toContain("'Zeus ⚡'")
    expect(sql).toContain("'Heracles 🦁'")
    expect(sql).toContain("'Ares 🗡️'")
    expect(sql).toContain("'Theseus 🐂'")
    expect(sql).toContain("'Athena 🦉'")
    expect(sql).toContain("'Atlas 🌍'")
    expect(sql).toContain("'Hades 🌑'")
    expect(sql).toContain("'Achilles 🛡️'")
  })

  it("ensures exact exercise names before eight strict seeds, then requires labels", () => {
    const sql = readPantheonMigration()
    const ensurePosition = sql.indexOf("INSERT INTO exercises")
    const strictPosition = sql.indexOf("SELECT id INTO STRICT")
    const constraintPosition = sql.indexOf("ALTER COLUMN label SET NOT NULL")

    expect(ensurePosition).toBeGreaterThanOrEqual(0)
    expect(strictPosition).toBeGreaterThan(ensurePosition)
    expect(sql.match(/INSERT INTO benchmark_circuits/g)).toHaveLength(8)
    expect(constraintPosition).toBeGreaterThan(strictPosition)
    expect(sql).not.toContain("'cindy'")
  })

  it("backfills leftover labels (forks) before SET NOT NULL", () => {
    const sql = readPantheonMigration()
    const inheritPosition = sql.indexOf("parent.label")
    const leftoverPosition = sql.indexOf("WHERE label IS NULL")
    const constraintPosition = sql.indexOf("ALTER COLUMN label SET NOT NULL")

    expect(inheritPosition).toBeGreaterThanOrEqual(0)
    expect(leftoverPosition).toBeGreaterThan(inheritPosition)
    expect(constraintPosition).toBeGreaterThan(leftoverPosition)
  })
})
