import type { GenerateProgramResponse } from "./types.ts"

export interface CatalogEntry {
  id: string
  muscle_group: string
}

export interface ValidatedDay {
  label: string
  muscle_focus: string
  exercise_ids: string[]
  dropped: number
  backfilled: number
}

export interface ValidateProgramResult {
  rationale: string
  days: ValidatedDay[]
  repaired: boolean
  totalDropped: number
  totalBackfilled: number
}

export function validateProgram(
  llmOutput: GenerateProgramResponse,
  catalog: CatalogEntry[],
  targetDayCount: number,
  exerciseBounds: { min: number; max: number },
): ValidateProgramResult {
  const catalogMap = new Map<string, CatalogEntry>()
  for (const entry of catalog) catalogMap.set(entry.id, entry)

  let days = llmOutput.days ?? []

  if (days.length === 0) {
    return {
      rationale: llmOutput.rationale ?? "",
      days: [],
      repaired: false,
      totalDropped: 0,
      totalBackfilled: 0,
    }
  }

  if (days.length > targetDayCount) days = days.slice(0, targetDayCount)

  const globalSeen = new Set<string>()
  let totalDropped = 0
  let totalBackfilled = 0
  const validatedDays: ValidatedDay[] = []

  const unusedByGroup = new Map<string, string[]>()
  for (const entry of catalog) {
    const list = unusedByGroup.get(entry.muscle_group) ?? []
    list.push(entry.id)
    unusedByGroup.set(entry.muscle_group, list)
  }

  for (const day of days) {
    const validIds: string[] = []
    let dropped = 0

    for (const id of day.exercise_ids ?? []) {
      if (globalSeen.has(id)) { dropped++; continue }

      const entry = catalogMap.get(id)
      if (!entry) { dropped++; continue }

      validIds.push(id)
      globalSeen.add(id)
      removeFromPool(unusedByGroup, entry.muscle_group, id)
    }

    let backfilled = 0
    while (validIds.length < exerciseBounds.min) {
      const picked = pickFromPool(unusedByGroup, day.muscle_focus, globalSeen)
      if (!picked) break
      validIds.push(picked)
      globalSeen.add(picked)
      backfilled++
    }

    if (validIds.length > exerciseBounds.max) {
      const excess = validIds.splice(exerciseBounds.max)
      for (const id of excess) globalSeen.delete(id)
    }

    totalDropped += dropped
    totalBackfilled += backfilled

    validatedDays.push({
      label: day.label ?? `Day ${validatedDays.length + 1}`,
      muscle_focus: day.muscle_focus ?? "",
      exercise_ids: validIds,
      dropped,
      backfilled,
    })
  }

  return {
    rationale: llmOutput.rationale ?? "",
    days: validatedDays,
    repaired: totalDropped > 0 || totalBackfilled > 0,
    totalDropped,
    totalBackfilled,
  }
}

function removeFromPool(pool: Map<string, string[]>, group: string, id: string) {
  const list = pool.get(group)
  if (!list) return
  const idx = list.indexOf(id)
  if (idx >= 0) list.splice(idx, 1)
  if (list.length === 0) pool.delete(group)
}

function pickFromPool(
  pool: Map<string, string[]>,
  preferredFocus: string,
  globalSeen: Set<string>,
): string | null {
  const focusGroups = preferredFocus.split(",").map((s) => s.trim())

  for (const group of focusGroups) {
    const list = pool.get(group)
    if (!list) continue
    for (let i = 0; i < list.length; i++) {
      if (!globalSeen.has(list[i])) {
        const [picked] = list.splice(i, 1)
        if (list.length === 0) pool.delete(group)
        return picked
      }
    }
  }

  for (const [group, list] of pool) {
    for (let i = 0; i < list.length; i++) {
      if (!globalSeen.has(list[i])) {
        const [picked] = list.splice(i, 1)
        if (list.length === 0) pool.delete(group)
        return picked
      }
    }
  }

  return null
}
