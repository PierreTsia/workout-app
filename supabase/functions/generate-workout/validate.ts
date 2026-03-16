export interface CatalogEntry {
  id: string
  muscle_group: string
}

export interface ValidationResult {
  exerciseIds: string[]
  repaired: boolean
  dropped: number
  backfilled: number
}

export function validateAndRepair(
  llmOutput: string[],
  catalog: CatalogEntry[],
  targetCount: number,
): ValidationResult {
  const catalogMap = new Map<string, CatalogEntry>()
  for (const entry of catalog) {
    catalogMap.set(entry.id, entry)
  }

  const validIds: string[] = []
  const droppedGroups: string[] = []
  const seen = new Set<string>()

  for (const id of llmOutput) {
    if (seen.has(id)) continue
    seen.add(id)

    const entry = catalogMap.get(id)
    if (entry) {
      validIds.push(id)
    } else {
      droppedGroups.push("unknown")
    }
  }

  const dropped = llmOutput.length - validIds.length

  if (validIds.length >= targetCount) {
    return {
      exerciseIds: validIds.slice(0, targetCount),
      repaired: dropped > 0,
      dropped,
      backfilled: 0,
    }
  }

  const usedIds = new Set(validIds)
  const unusedByGroup = new Map<string, string[]>()
  for (const entry of catalog) {
    if (usedIds.has(entry.id)) continue
    const list = unusedByGroup.get(entry.muscle_group) ?? []
    list.push(entry.id)
    unusedByGroup.set(entry.muscle_group, list)
  }

  let backfilled = 0
  const slotsNeeded = targetCount - validIds.length

  for (let i = 0; i < slotsNeeded; i++) {
    const targetGroup = droppedGroups[i] ?? null
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

    if (picked) {
      validIds.push(picked)
      usedIds.add(picked)
      backfilled++
    } else {
      break
    }
  }

  return {
    exerciseIds: validIds,
    repaired: dropped > 0 || backfilled > 0,
    dropped,
    backfilled,
  }
}
