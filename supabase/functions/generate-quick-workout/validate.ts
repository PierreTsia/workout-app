import {
  circuitTerminationFields,
  shouldRejectAmrapCircuit,
} from "../_shared/amrapCircuitValidate.ts"

export interface CatalogEntry {
  id: string
  muscle_group: string
}

export type QwCircuitExercise =
  | { exercise_id: string; amount: number; weight_kg: number }
  | { exercise_id: string; per_round: { amount: number; weight_kg: number }[] }

export interface QwCircuitItem {
  type: "circuit"
  label?: string
  mode?: "rounds" | "amrap"
  cap_minutes?: number
  rounds?: number
  rest_seconds?: number
  transition_seconds?: number
  exercises: QwCircuitExercise[]
}

/** Post-LLM catalog replace (T192): no nested exercises — MCP instantiates Rx. */
export interface QwCatalogCircuitItem {
  type: "circuit"
  benchmark_slug: string
}

export type QwDayItem = string | QwCircuitItem | QwCatalogCircuitItem

export interface ValidationResult {
  /** Day sequence: bare UUIDs and Circuits (Circuit = 1 slot). */
  items: QwDayItem[]
  /**
   * Flat catalog IDs for hydration / legacy clients (solos + nested Circuit IDs).
   * Order is not a day sequence — use `items` for structure.
   */
  exerciseIds: string[]
  repaired: boolean
  dropped: number
  backfilled: number
}

function isCatalogCircuitItem(raw: unknown): raw is QwCatalogCircuitItem {
  if (typeof raw !== "object" || raw === null) return false
  if (!("type" in raw) || raw.type !== "circuit") return false
  if (!("benchmark_slug" in raw) || typeof raw.benchmark_slug !== "string") {
    return false
  }
  return raw.benchmark_slug.trim() !== ""
}

function isCircuitItem(raw: unknown): raw is QwCircuitItem | QwCatalogCircuitItem {
  if (isCatalogCircuitItem(raw)) return true
  return (
    typeof raw === "object" &&
    raw !== null &&
    "type" in raw &&
    raw.type === "circuit" &&
    "exercises" in raw &&
    Array.isArray(raw.exercises)
  )
}

function normalizeInput(llmOutput: string[] | QwDayItem[]): QwDayItem[] {
  return llmOutput.map((raw) => {
    if (typeof raw === "string") return raw
    if (isCircuitItem(raw)) return raw
    return String(raw)
  })
}

export function collectQwExerciseIds(items: QwDayItem[]): string[] {
  return items.flatMap((item) => {
    if (typeof item === "string") return [item]
    if (!("exercises" in item) || item.exercises == null) return []
    return item.exercises.map((e) => e.exercise_id)
  })
}

/**
 * Validate / repair QW LLM output. Accepts legacy `string[]` or mixed day-items
 * (UUID | Circuit). A Circuit counts as one slot toward `targetCount`.
 */
export function validateAndRepair(
  llmOutput: string[] | QwDayItem[],
  catalog: CatalogEntry[],
  targetCount: number,
): ValidationResult {
  const catalogMap = new Map<string, CatalogEntry>()
  for (const entry of catalog) {
    catalogMap.set(entry.id, entry)
  }

  const items: QwDayItem[] = []
  const droppedGroups: string[] = []
  const seenSolos = new Set<string>()
  let dropped = 0

  for (const raw of normalizeInput(llmOutput)) {
    if (typeof raw === "string") {
      const id = raw
      if (seenSolos.has(id)) {
        dropped++
        continue
      }
      const entry = catalogMap.get(id)
      if (!entry) {
        dropped++
        droppedGroups.push("unknown")
        continue
      }
      items.push(id)
      seenSolos.add(id)
      continue
    }

    if (isCatalogCircuitItem(raw)) {
      items.push({ type: "circuit", benchmark_slug: raw.benchmark_slug.trim() })
      continue
    }

    if (!("exercises" in raw) || !Array.isArray(raw.exercises)) {
      dropped++
      continue
    }

    if (shouldRejectAmrapCircuit(raw)) {
      dropped++
      continue
    }

    const nested = raw.exercises
      .map((ex) => {
        if (!ex || typeof ex !== "object" || typeof ex.exercise_id !== "string") {
          return null
        }
        if (!catalogMap.has(ex.exercise_id)) return null
        return ex
      })
      .filter((ex): ex is QwCircuitExercise => ex != null)

    if (nested.length < 2) {
      dropped++
      continue
    }

    items.push({
      type: "circuit",
      exercises: nested,
      ...(raw.label !== undefined ? { label: raw.label } : {}),
      ...circuitTerminationFields(raw),
    })

    for (const ex of nested) {
      seenSolos.add(ex.exercise_id)
    }
  }

  const usedIds = new Set(collectQwExerciseIds(items))
  const unusedByGroup = new Map<string, string[]>()
  for (const entry of catalog) {
    if (usedIds.has(entry.id)) continue
    const list = unusedByGroup.get(entry.muscle_group) ?? []
    unusedByGroup.set(entry.muscle_group, [...list, entry.id])
  }

  let backfilled = 0

  if (items.length > targetCount) {
    items.splice(targetCount)
  }

  while (items.length < targetCount) {
    const targetGroup = droppedGroups[backfilled] ?? null
    let picked: string | undefined

    if (targetGroup && targetGroup !== "unknown") {
      const groupPool = unusedByGroup.get(targetGroup)
      if (groupPool && groupPool.length > 0) {
        const idx = Math.floor(Math.random() * groupPool.length)
        picked = groupPool.splice(idx, 1)[0]
      }
    }

    if (!picked) {
      for (const [group, pool] of unusedByGroup) {
        if (pool.length > 0) {
          const idx = Math.floor(Math.random() * pool.length)
          picked = pool.splice(idx, 1)[0]
          if (pool.length === 0) unusedByGroup.delete(group)
          break
        }
      }
    }

    if (!picked) break
    items.push(picked)
    usedIds.add(picked)
    backfilled++
  }

  return {
    items,
    exerciseIds: collectQwExerciseIds(items),
    repaired: dropped > 0 || backfilled > 0,
    dropped,
    backfilled,
  }
}
