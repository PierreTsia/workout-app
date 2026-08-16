import { templateCell, templateFingerprint } from "@/lib/blockTemplate"
import type {
  BenchmarkCircuitReference,
  BenchmarkCircuitRx,
  PerRoundCell,
} from "@/types/database"

export interface CircuitForkPending {
  mode: BenchmarkCircuitRx["mode"]
  cap_seconds: number | null
  exercises: { exercise_id: string; per_round: PerRoundCell[] }[]
}

export function needsCircuitFork(input: {
  benchmarkCircuitId: string | null | undefined
  catalogOwnerId: string | null | undefined
  currentUserId: string
  catalogRx: BenchmarkCircuitRx
  pending: CircuitForkPending
}): boolean {
  if (input.benchmarkCircuitId == null || input.benchmarkCircuitId === "") {
    return false
  }
  if (input.catalogOwnerId === input.currentUserId) return false
  return templateFingerprint(input.pending) !== catalogCanonicalFingerprint(input.catalogRx)
}

function catalogCanonicalFingerprint(rx: BenchmarkCircuitRx): string {
  return templateFingerprint({
    mode: rx.mode,
    cap_seconds: rx.cap_seconds,
    exercises: rx.exercises.map((ex) => ({
      exercise_id: ex.exercise_id,
      per_round: [{ amount: ex.amount, weight: ex.weight }],
    })),
  })
}

export interface CircuitForkCatalog {
  id: string
  owner_id: string | null
  label: string
  aliases: string[]
  tagline_fr: string | null
  tagline_en: string | null
  story_fr: string | null
  story_en: string | null
  reference: BenchmarkCircuitReference | null
  rx: BenchmarkCircuitRx
}

export interface CircuitForkInsertRow {
  slug: null
  owner_id: string
  forked_from: string
  label: string
  aliases: string[]
  tagline_fr: string | null
  tagline_en: string | null
  story_fr: string | null
  story_en: string | null
  reference: BenchmarkCircuitReference | null
  rx: BenchmarkCircuitRx
}

export interface CircuitForkWriter {
  insertFork: (row: CircuitForkInsertRow) => Promise<{ id: string }>
  retargetBlock: (blockId: string, forkedId: string) => Promise<void>
}

export function pendingToRx(pending: CircuitForkPending): BenchmarkCircuitRx {
  return {
    mode: pending.mode,
    cap_seconds: pending.cap_seconds,
    exercises: pending.exercises.map((ex) => {
      const cell = templateCell(ex, 0, pending.mode)
      return {
        exercise_id: ex.exercise_id,
        amount: cell.amount,
        weight: cell.weight,
      }
    }),
  }
}

export function buildForkInsertRow(
  catalog: CircuitForkCatalog,
  currentUserId: string,
  pending: CircuitForkPending,
): CircuitForkInsertRow {
  return {
    slug: null,
    owner_id: currentUserId,
    forked_from: catalog.id,
    label: catalog.label,
    aliases: [],
    tagline_fr: catalog.tagline_fr,
    tagline_en: catalog.tagline_en,
    story_fr: catalog.story_fr,
    story_en: catalog.story_en,
    reference: catalog.reference,
    rx: pendingToRx(pending),
  }
}

export async function persistCircuitFork(
  writer: CircuitForkWriter,
  input: {
    catalog: CircuitForkCatalog
    currentUserId: string
    pending: CircuitForkPending
    blockId: string
    persistMeta?: () => Promise<void>
  },
): Promise<{ forkedId: string }> {
  const inserted = await writer.insertFork(
    buildForkInsertRow(input.catalog, input.currentUserId, input.pending),
  )
  if (input.persistMeta != null) {
    await input.persistMeta()
  }
  await writer.retargetBlock(input.blockId, inserted.id)
  return { forkedId: inserted.id }
}

export function pendingFromBlock(
  block: {
    mode: CircuitForkPending["mode"]
    cap_seconds: number | null
    exercises: { id: string; exercise_id: string; per_round: PerRoundCell[] }[]
  },
  override?: { blockExerciseId: string; per_round: PerRoundCell[] },
): CircuitForkPending {
  return {
    mode: block.mode,
    cap_seconds: block.cap_seconds,
    exercises: block.exercises.map((ex) => ({
      exercise_id: ex.exercise_id,
      per_round:
        override?.blockExerciseId === ex.id ? override.per_round : ex.per_round,
    })),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  if (value == null) return null
  return typeof value === "string" ? value : null
}

function parseReference(value: unknown): BenchmarkCircuitReference | null {
  if (!isRecord(value)) return null
  if (typeof value.name !== "string" || typeof value.score !== "string") {
    return null
  }
  return { name: value.name, score: value.score }
}

function parseRx(value: unknown): BenchmarkCircuitRx | null {
  if (!isRecord(value)) return null
  if (value.mode !== "amrap" && value.mode !== "rounds") return null
  if (value.cap_seconds != null && typeof value.cap_seconds !== "number") {
    return null
  }
  if (!Array.isArray(value.exercises)) return null
  const exercises = value.exercises.flatMap((ex) => {
    if (!isRecord(ex)) return []
    if (typeof ex.exercise_id !== "string") return []
    if (typeof ex.amount !== "number" || typeof ex.weight !== "number") return []
    return [
      {
        exercise_id: ex.exercise_id,
        amount: ex.amount,
        weight: ex.weight,
      },
    ]
  })
  if (exercises.length !== value.exercises.length) return null
  return {
    mode: value.mode,
    cap_seconds: value.cap_seconds ?? null,
    exercises,
  }
}

export function parseCircuitForkCatalog(
  row: unknown,
): CircuitForkCatalog | null {
  if (!isRecord(row) || typeof row.id !== "string") return null
  if (row.owner_id != null && typeof row.owner_id !== "string") return null
  const rx = parseRx(row.rx)
  if (rx == null) return null
  const label = typeof row.label === "string" ? row.label.trim() : ""
  if (label === "") return null
  const aliases = Array.isArray(row.aliases)
    ? row.aliases.filter((alias) => typeof alias === "string")
    : []
  return {
    id: row.id,
    owner_id: row.owner_id ?? null,
    label,
    aliases,
    tagline_fr: stringOrNull(row.tagline_fr),
    tagline_en: stringOrNull(row.tagline_en),
    story_fr: stringOrNull(row.story_fr),
    story_en: stringOrNull(row.story_en),
    reference: parseReference(row.reference),
    rx,
  }
}

export function parseInsertedForkId(data: unknown): string | null {
  if (!isRecord(data) || typeof data.id !== "string") return null
  return data.id
}
