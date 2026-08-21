import { PIERRE_SET_CREDIT_SCALE } from "./profileChartData"

export type LessonT = (
  key: string,
  options?: Record<string, string | number>,
) => string

export function mixLesson(
  row:
    | { programme: number; quickWorkout: number; circuits: number }
    | undefined,
  t: LessonT,
): string {
  if (row == null) return t("mix.tooltip.rest")
  const parts = (
    [
      { key: "programme" as const, n: row.programme },
      { key: "quickWorkout" as const, n: row.quickWorkout },
      { key: "circuits" as const, n: row.circuits },
    ] as const
  )
    .filter((slice) => slice.n > 0)
    .map((slice) =>
      t("mix.tooltip.slice", { n: slice.n, slice: t(`mix.slice.${slice.key}`) }),
    )
  if (parts.length === 0) return t("mix.tooltip.rest")
  return parts.join(" · ")
}

export function rhythmLesson(
  hits: number | undefined,
  target: number,
  t: LessonT,
): string {
  const n = hits ?? 0
  if (n === 0) return t("rhythm.tooltip.empty")
  if (n < target) return t("rhythm.tooltip.short", { n, target })
  if (n === target) return t("rhythm.tooltip.onTarget", { n, target })
  return t("rhythm.tooltip.over", { n, target })
}

export function recordsLesson(
  row: { prs: number; rir0: number | null } | undefined,
  t: LessonT,
): string {
  if (row == null) return t("records.tooltip.none")
  if (row.rir0 == null) return t("records.tooltip.noRir", { prs: row.prs })
  return t("records.tooltip.combo", { prs: row.prs, rir0: row.rir0 })
}

export function radarLesson(
  row:
    | {
        muscle: string
        current: number
        prior?: number
        currentSets?: number
        priorSets?: number
      }
    | undefined,
  t: LessonT,
): string {
  if (row == null) return t("balance.tooltip.idle")
  const sets = Math.round(row.currentSets ?? row.current * PIERRE_SET_CREDIT_SCALE)
  if (row.prior === undefined && row.priorSets === undefined) {
    return t("balance.tooltip.muscle", { muscle: row.muscle, sets })
  }
  const prior = Math.round(
    row.priorSets ?? (row.prior ?? 0) * PIERRE_SET_CREDIT_SCALE,
  )
  if (sets > prior) {
    return t("balance.tooltip.up", { muscle: row.muscle, sets, prior })
  }
  if (sets < prior) {
    return t("balance.tooltip.down", { muscle: row.muscle, sets, prior })
  }
  return t("balance.tooltip.even", { muscle: row.muscle, sets })
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  if (value == null || typeof value !== "object") return undefined
  return Object.fromEntries(Object.entries(value))
}

export function readMixRow(value: unknown) {
  const row = recordOf(value)
  if (row == null) return undefined
  const { programme, quickWorkout, circuits } = row
  if (
    typeof programme !== "number" ||
    typeof quickWorkout !== "number" ||
    typeof circuits !== "number"
  ) {
    return undefined
  }
  return { programme, quickWorkout, circuits }
}

export function readRhythmHits(value: unknown) {
  const row = recordOf(value)
  if (row == null || typeof row.hits !== "number") return undefined
  return row.hits
}

export function readRecordsRow(value: unknown) {
  const row = recordOf(value)
  if (row == null || typeof row.prs !== "number") return undefined
  const rir0 = row.rir0
  if (rir0 !== null && typeof rir0 !== "number") return undefined
  return { prs: row.prs, rir0 }
}

export function readRadarRow(value: unknown) {
  const row = recordOf(value)
  if (row == null || typeof row.muscle !== "string" || typeof row.current !== "number") {
    return undefined
  }
  return {
    muscle: row.muscle,
    current: row.current,
    prior: typeof row.prior === "number" ? row.prior : undefined,
    currentSets: typeof row.currentSets === "number" ? row.currentSets : undefined,
    priorSets: typeof row.priorSets === "number" ? row.priorSets : undefined,
  }
}
