import { describe, expect, it } from "vitest"

const sources = import.meta.glob("../**/*.{ts,tsx}", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

describe("ProgramDetailSheet", () => {
  it("has zero remaining imports or call sites", () => {
    const offenders = Object.entries(sources).filter(([path, source]) => {
      if (path.includes("programDetailSheet.arch.test")) return false
      return source.includes("ProgramDetailSheet")
    })

    expect(offenders.map(([path]) => path)).toEqual([])
  })
})
