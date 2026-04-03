/**
 * Training balance score + agonist/antagonist insights (#160).
 * Set weights must stay aligned with get_volume_by_muscle_group (primary 1, secondary 0.5 in SQL).
 */

export const MUSCLE_TAXONOMY = [
  "Pectoraux",
  "Dos",
  "Épaules",
  "Biceps",
  "Triceps",
  "Quadriceps",
  "Ischios",
  "Fessiers",
  "Adducteurs",
  "Mollets",
  "Abdos",
  "Trapèzes",
  "Lombaires",
] as const

export type MuscleTaxonomy = (typeof MUSCLE_TAXONOMY)[number]

export const AGONIST_PAIRS = [
  { name: "chest_back", a: "Pectoraux", b: "Dos" },
  { name: "biceps_triceps", a: "Biceps", b: "Triceps" },
  { name: "quads_hams", a: "Quadriceps", b: "Ischios" },
  { name: "abs_lower_back", a: "Abdos", b: "Lombaires" },
] as const satisfies ReadonlyArray<{
  name: string
  a: MuscleTaxonomy
  b: MuscleTaxonomy
}>

export type BalanceBand = "excellent" | "good" | "attention" | "imbalanced"

export function balanceBandFromScore(score: number): BalanceBand {
  if (score >= 85) return "excellent"
  if (score >= 70) return "good"
  if (score >= 50) return "attention"
  return "imbalanced"
}

/**
 * Balance score from coefficient of variation on **log1p(set weights)** (13 values, zeros included).
 *
 * Raw CV on linear sets made typical programs look “broken” (e.g. ~23 for 12/13 muscles with
 * volume) because one zero plus 66 vs 6 spread explodes σ/μ. `log1p` compresses large counts,
 * keeps ln(1+0)=0 so neglected groups still hurt, and matches the product intent: unevenness
 * without implying “almost no training”.
 */
export function computeBalanceScore(setsPerMuscle: readonly number[]): number {
  const n = setsPerMuscle.length
  if (n === 0) return 0

  const transformed = setsPerMuscle.map((x) => Math.log1p(Math.max(0, x)))
  const mean = transformed.reduce((s, x) => s + x, 0) / n
  if (mean === 0) return 0

  const variance =
    transformed.reduce((s, x) => s + (x - mean) ** 2, 0) / n
  const std = Math.sqrt(variance)
  const cv = std / mean

  return Math.max(0, Math.round((1 - cv) * 100))
}

export type PairInsightKind = "untrained" | "skewed"

export interface PairInsight {
  pairName: string
  kind: PairInsightKind
  /** Muscle taxonomy key that is the focus of the message (untrained side or higher-volume side for skewed) */
  focusMuscle: MuscleTaxonomy
  otherMuscle: MuscleTaxonomy
  /** min(a,b) / max(a,b); 1 when both zero */
  ratio: number
}

/**
 * Pair-specific callouts. Skips pairs where both sides have zero sets.
 * - untrained: one side 0, other > 0
 * - skewed: both > 0 and ratio < 0.5
 */
export function computePairInsights(
  setsByMuscle: Readonly<Record<string, number>>,
): PairInsight[] {
  return AGONIST_PAIRS.flatMap((pair): PairInsight[] => {
    const a = setsByMuscle[pair.a] ?? 0
    const b = setsByMuscle[pair.b] ?? 0

    if (a === 0 && b === 0) return []

    if (a === 0 || b === 0) {
      const focus = a === 0 ? pair.a : pair.b
      const other = a === 0 ? pair.b : pair.a
      return [
        {
          pairName: pair.name,
          kind: "untrained" as const,
          focusMuscle: focus,
          otherMuscle: other,
          ratio: 0,
        },
      ]
    }

    const min = Math.min(a, b)
    const max = Math.max(a, b)
    const ratio = min / max

    if (ratio >= 0.5) return []

    const focusMuscle = a >= b ? pair.a : pair.b

    return [
      {
        pairName: pair.name,
        kind: "skewed" as const,
        focusMuscle,
        otherMuscle: focusMuscle === pair.a ? pair.b : pair.a,
        ratio,
      },
    ]
  })
}

export function setsVectorFromRows(
  muscles: ReadonlyArray<{ muscle_group: string; total_sets: number }>,
): number[] {
  const byName = new Map(muscles.map((m) => [m.muscle_group, m.total_sets]))
  return MUSCLE_TAXONOMY.map((m) => byName.get(m) ?? 0)
}

export function setsRecordFromRows(
  muscles: ReadonlyArray<{ muscle_group: string; total_sets: number }>,
): Record<MuscleTaxonomy, number> {
  const vec = setsVectorFromRows(muscles)
  return Object.fromEntries(
    MUSCLE_TAXONOMY.map((m, i) => [m, vec[i]]),
  ) as Record<MuscleTaxonomy, number>
}

export function zeroVolumeMuscles(
  muscles: ReadonlyArray<{ muscle_group: string; total_sets: number }>,
): MuscleTaxonomy[] {
  return MUSCLE_TAXONOMY.filter((m) => {
    const row = muscles.find((r) => r.muscle_group === m)
    return (row?.total_sets ?? 0) === 0
  })
}
