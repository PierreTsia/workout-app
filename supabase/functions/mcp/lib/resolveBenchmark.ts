/**
 * Edge twin of `src/lib/resolveBenchmark.ts` (T191 / #398).
 * Keep in lockstep — no `@/` imports.
 */

export interface BenchmarkRxExercise {
  exercise_id: string
  amount: number
  weight: number
}

export interface BenchmarkRx {
  mode: "amrap" | "rounds"
  cap_seconds: number | null
  exercises: BenchmarkRxExercise[]
}

export interface BenchmarkCircuitLookup {
  id: string
  slug: string | null
  aliases: string[]
  rx: BenchmarkRx
}

export function normalizeBenchmarkKey(value: string): string {
  return value.trim().toLowerCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Collect rx exercise ids for Circuit items that resolve to a catalog row. */
export function collectReferencedBenchmarkExerciseIds(
  raw: unknown[],
  catalog: readonly BenchmarkCircuitLookup[],
): string[] {
  return raw.flatMap((entry) => {
    if (!isRecord(entry) || entry.type !== "circuit") return []
    const slug = typeof entry.benchmark_slug === "string" ? entry.benchmark_slug : null
    const id = typeof entry.benchmark_id === "string" ? entry.benchmark_id : null
    const label = typeof entry.label === "string" ? entry.label : null
    const found = resolveBenchmark(catalog, { slug, id, label })
    return found ? found.rx.exercises.map((ex) => ex.exercise_id) : []
  })
}

function rowMatchesKey(row: BenchmarkCircuitLookup, key: string): boolean {
  if (row.slug != null && normalizeBenchmarkKey(row.slug) === key) return true
  return row.aliases.some((alias) => normalizeBenchmarkKey(alias) === key)
}

export function resolveBenchmark(
  catalog: readonly BenchmarkCircuitLookup[],
  query: { id?: string | null; slug?: string | null; label?: string | null },
): BenchmarkCircuitLookup | null {
  const id = query.id
  if (id != null && id.trim() !== "") {
    return catalog.find((row) => row.id === id.trim()) ?? null
  }
  const keySource = query.slug != null && query.slug.trim() !== "" ? query.slug : query.label
  if (keySource == null || keySource.trim() === "") return null
  const key = normalizeBenchmarkKey(keySource)
  return catalog.find((row) => rowMatchesKey(row, key)) ?? null
}
