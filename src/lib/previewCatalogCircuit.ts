import { resolveBenchmark, type BenchmarkCircuitLookup } from "@/lib/resolveBenchmark"
import type { ExerciseListItem } from "@/types/database"
import type { GeneratedCircuit } from "@/types/generator"

export interface CatalogPreviewRow extends BenchmarkCircuitLookup {
  tagline_fr: string | null
  tagline_en: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function parseRx(raw: unknown): BenchmarkCircuitLookup["rx"] | null {
  if (!isRecord(raw)) return null
  if (raw.mode !== "amrap" && raw.mode !== "rounds") return null
  const cap = raw.cap_seconds
  if (cap !== null && cap !== undefined && (typeof cap !== "number" || !Number.isFinite(cap))) {
    return null
  }
  if (!Array.isArray(raw.exercises)) return null
  const exercises = raw.exercises.flatMap((ex) => {
    if (!isRecord(ex) || typeof ex.exercise_id !== "string") return []
    if (typeof ex.amount !== "number" || typeof ex.weight !== "number") return []
    return [{ exercise_id: ex.exercise_id, amount: ex.amount, weight: ex.weight }]
  })
  if (exercises.length !== raw.exercises.length) return null
  return {
    mode: raw.mode,
    cap_seconds: typeof cap === "number" ? cap : null,
    exercises,
  }
}

export function parseCatalogPreviewRow(raw: unknown): CatalogPreviewRow | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null
  if (typeof raw.label !== "string" || raw.label.trim() === "") return null
  const rx = parseRx(raw.rx)
  if (!rx) return null
  const aliases = Array.isArray(raw.aliases)
    ? raw.aliases.filter((alias): alias is string => typeof alias === "string")
    : []
  return {
    id: raw.id,
    slug: typeof raw.slug === "string" ? raw.slug : null,
    label: raw.label,
    aliases,
    rx,
    tagline_fr: stringOrNull(raw.tagline_fr),
    tagline_en: stringOrNull(raw.tagline_en),
  }
}

export function generatedCircuitFromCatalog(
  row: CatalogPreviewRow,
  byId: ReadonlyMap<string, ExerciseListItem>,
): GeneratedCircuit {
  const slug = row.slug
  if (slug == null || slug.trim() === "") {
    throw new Error("generatedCircuitFromCatalog: catalog row has no slug")
  }
  const missing = row.rx.exercises
    .map((ex) => ex.exercise_id)
    .filter((id) => !byId.has(id))
  if (missing.length > 0) {
    throw new Error(
      `generatedCircuitFromCatalog: missing exercise_id(s): ${missing.join(", ")}`,
    )
  }

  const isAmrap = row.rx.mode === "amrap"
  const exercises = row.rx.exercises.map((ex) => {
    const exercise = byId.get(ex.exercise_id)
    if (!exercise) {
      throw new Error(`generatedCircuitFromCatalog: missing exercise_id ${ex.exercise_id}`)
    }
    return { exercise, amount: ex.amount, weightKg: ex.weight }
  })

  const taglineFr = row.tagline_fr ?? undefined
  const taglineEn = row.tagline_en ?? undefined

  return {
    benchmarkSlug: slug,
    label: row.label,
    ...(taglineFr ? { taglineFr } : {}),
    ...(taglineEn ? { taglineEn } : {}),
    ...(isAmrap
      ? {
          mode: "amrap" as const,
          capMinutes: row.rx.cap_seconds != null ? Math.round(row.rx.cap_seconds / 60) : 20,
          rounds: 1,
          restSeconds: 0,
          transitionSeconds: 0,
        }
      : {
          rounds: 1,
          restSeconds: 90,
          transitionSeconds: 0,
        }),
    exercises,
  }
}

export function catalogRowForSlug(
  catalog: readonly CatalogPreviewRow[],
  slug: string,
): CatalogPreviewRow | null {
  const found = resolveBenchmark(catalog, { slug })
  if (!found) return null
  return catalog.find((row) => row.id === found.id) ?? null
}
