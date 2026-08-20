import { sheetCatalogId, type SessionHistoryItem } from "@/lib/sessionHistoryGrouping"

export type SessionCoverage =
  | { comparable: false }
  | { comparable: true; equal: true }
  | {
      comparable: true
      equal: false
      loggedItems: number
      programItems: number
    }

/** Live sequence identities sessionCoverage needs — not the full DayItem row. */
export type CoverageDayItem =
  | { kind: "block"; block: { benchmark_circuit_id?: string | null } }
  | { kind: "solo"; exercise: { exercise_id: string } }

function sameIds(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id))
}

function presentIds(ids: Array<string | null>): Set<string> {
  return new Set(ids.flatMap((id) => (id == null ? [] : [id])))
}

function catalogIds(
  ids: Array<string | null>,
): { comparable: false } | { comparable: true; ids: Set<string> } {
  if (ids.some((id) => id == null)) return { comparable: false }
  return { comparable: true, ids: presentIds(ids) }
}

export function sessionCoverage(
  items: SessionHistoryItem[],
  blockRuns: Map<string, { benchmarkCircuitId: string | null }>,
  dayItems: readonly CoverageDayItem[],
): SessionCoverage {
  const loggedCircuits = catalogIds(
    items.flatMap((item) =>
      item.kind === "block"
        ? [
            sheetCatalogId(
              item.benchmarkCircuitId,
              blockRuns.get(item.key)?.benchmarkCircuitId,
            ),
          ]
        : [],
    ),
  )
  if (!loggedCircuits.comparable) return { comparable: false }

  const loggedSolos = new Set(
    items.flatMap((item) => (item.kind === "solo" ? [item.key] : [])),
  )
  const programCircuits = catalogIds(
    dayItems.flatMap((item) =>
      item.kind === "block" ? [item.block.benchmark_circuit_id ?? null] : [],
    ),
  )
  if (!programCircuits.comparable) return { comparable: false }

  const programSolos = new Set(
    dayItems.flatMap((item) =>
      item.kind === "solo" ? [item.exercise.exercise_id] : [],
    ),
  )

  if (
    sameIds(loggedCircuits.ids, programCircuits.ids) &&
    sameIds(loggedSolos, programSolos)
  ) {
    return { comparable: true, equal: true }
  }

  return {
    comparable: true,
    equal: false,
    loggedItems: items.length,
    programItems: dayItems.length,
  }
}
