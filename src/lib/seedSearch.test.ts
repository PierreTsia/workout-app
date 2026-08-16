import { describe, expect, it } from "vitest"
import { seedMatchesQuery } from "./seedSearch"

function makeSeedRow(
  overrides: {
    slug?: string | null
    aliases?: string[]
    tagline_fr?: string | null
    tagline_en?: string | null
  } = {},
) {
  return {
    slug: "cindy",
    aliases: ["holland", "tom holland"],
    tagline_fr: "Le WOD de Tom Holland.",
    tagline_en: "Tom Holland’s WOD.",
    ...overrides,
  }
}

const taglineOnly = makeSeedRow({
  slug: "zeus",
  aliases: [],
})

describe("seedMatchesQuery", () => {
  it.each([
    { query: "c", expected: false, row: makeSeedRow() },
    { query: "ci", expected: true, row: makeSeedRow() },
    { query: "ho", expected: true, row: makeSeedRow() },
    { query: "HOLLAND", expected: true, row: makeSeedRow() },
    { query: "holland", expected: true, row: taglineOnly },
    { query: "wod", expected: true, row: taglineOnly },
  ])("is $expected for query $query", ({ query, expected, row }) => {
    expect(seedMatchesQuery(row, query)).toBe(expected)
  })
})
