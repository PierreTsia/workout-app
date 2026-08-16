import { normalizeBenchmarkKey } from "./resolveBenchmark"

export interface SeedSearchRow {
  slug: string | null
  aliases: readonly string[]
  tagline_fr: string | null
  tagline_en: string | null
}

function startsWithQuery(value: string | null, query: string): boolean {
  return value != null && normalizeBenchmarkKey(value).startsWith(query)
}

function includesQuery(value: string | null, query: string): boolean {
  return value != null && normalizeBenchmarkKey(value).includes(query)
}

export function seedMatchesQuery(row: SeedSearchRow, query: string): boolean {
  const normalized = normalizeBenchmarkKey(query)
  if (normalized.length < 2) return false

  const prefixHaystacks = [row.slug, ...row.aliases]
  const includeHaystacks = [row.tagline_en, row.tagline_fr]

  return (
    prefixHaystacks.some((value) => startsWithQuery(value, normalized)) ||
    includeHaystacks.some((value) => includesQuery(value, normalized))
  )
}
