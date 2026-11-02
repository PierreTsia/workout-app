import { describe, expect, it } from "vitest"

/**
 * T716 (#729) / ADR 0035 — the locale argument localizes only the dry-run echo.
 * Nothing localized may reach persistence: the write tools must not hand `locale`
 * to the insert path, and the Catalog Snapshot must keep writing the canonical
 * French `name` (ADR 0010), never `name_en`.
 */
const sources = import.meta.glob("../../supabase/functions/mcp/**/*.ts", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const read = (suffix: string): string => {
  const entry = Object.entries(sources).find(([path]) => path.endsWith(suffix))
  if (!entry) throw new Error(`source not found: ${suffix}`)
  return entry[1]
}

const insertCallArgs = (source: string): string[] => {
  const blocks = [...source.matchAll(/insertDaySequence\s*\(([\s\S]*?)\)/g)]
  return blocks.map(([, args]) => args)
}

describe("locale never reaches persistence (T716)", () => {
  for (const tool of ["tools/createProgram.ts", "tools/createWorkoutDay.ts"]) {
    it(`${tool} passes no locale to insertDaySequence`, () => {
      const args = insertCallArgs(read(tool))
      expect(args.length).toBeGreaterThan(0)
      expect(args.some((a) => /locale/.test(a))).toBe(false)
    })
  }

  it("the Catalog Snapshot keeps writing the canonical French name", () => {
    const persistence = read("lib/programPersistence.ts")
    expect(persistence).toMatch(/name_snapshot:\s*ge\.exercise\.name\b/)
    expect(persistence).not.toMatch(/name_snapshot:\s*[^\n]*name_en/)
  })

  it("get_training_stats resolves the PR names from the catalog, not the snapshot", () => {
    // The blocking finding of PR #730: formatStatsSummary localizes muscle labels but
    // renders PR lines from the frozen snapshot unless the handler resolves first.
    const source = read("tools/getTrainingStats.ts")
    expect(source).toMatch(/resolveDisplayName/)
    expect(source).toMatch(/from\("exercises"\)/)
  })
})
