import type { WeightUnit } from "@/lib/rirSuggestion"

/**
 * The **Load Ladder** — the ordered list of loads the athlete can actually
 * compose in the gym. Resolved by equipment category; the engine never
 * prescribes a load outside the ladder (ADR 0034).
 *
 * Pure module: no React, no Supabase, no network. Same shape as
 * `src/lib/rirSuggestion.ts` for the intra-session increment.
 */
export type LadderCategory = "dumbbell" | "barbell" | "stack"

/**
 * Equipment slug → ladder category. Keyed on `EQUIPMENT_TAXONOMY`: the six
 * ladder-bearing slugs fold onto three ladders, the rest declare none and fall
 * back to the legacy increment.
 */
export const LOAD_LADDER_CATEGORY: Record<string, LadderCategory | null> = {
  barbell: "barbell",
  dumbbell: "dumbbell",
  machine: "stack",
  cable: "stack",
  kettlebell: "dumbbell",
  ez_bar: "barbell",
  bodyweight: null,
  bench: null,
  band: null,
  other: null,
}

/**
 * The default ladders, in the athlete's display unit, exactly as the Tech Plan
 * writes them. A documented guess (a standard plate set), not the athlete's
 * gym — same status as `LOAD_JUMP_MAX_RATIO`.
 */
export const DEFAULT_LOAD_LADDERS: Record<
  WeightUnit,
  Partial<Record<LadderCategory, number[]>>
> = {
  kg: {
    dumbbell: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50],
    barbell: [
      20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 45, 50, 55, 60, 70, 80, 90,
      100, 110, 120,
    ],
    stack: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100],
  },
  lbs: {
    dumbbell: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100],
    barbell: [
      45, 50, 55, 65, 75, 85, 95, 115, 135, 155, 185, 205, 225, 245, 275, 315,
    ],
    stack: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160],
  },
}

const LBS_PER_KG = 2.20462

const toKg = (unit: WeightUnit, value: number): number =>
  unit === "lbs" ? value / LBS_PER_KG : value

/**
 * The canonical table read by the resolution: the literals above, converted to
 * kg once at module load. A 45 lb rung is stored as 20,4116 kg — that value is
 * prescribed and stored, and the display renders it back as 45,0.
 */
export const LOAD_LADDERS_KG: Record<
  WeightUnit,
  Partial<Record<LadderCategory, number[]>>
> = {
  kg: Object.fromEntries(
    Object.entries(DEFAULT_LOAD_LADDERS.kg).map(([category, ladder]) => [
      category,
      ladder!.map((value) => toKg("kg", value)),
    ]),
  ),
  lbs: Object.fromEntries(
    Object.entries(DEFAULT_LOAD_LADDERS.lbs).map(([category, ladder]) => [
      category,
      ladder!.map((value) => toKg("lbs", value)),
    ]),
  ),
}

/**
 * Display-rounding tolerance: `toDisplay` renders one decimal in lbs, so a 45 lb
 * rung stored as 20,4 kg must still recognise itself and step to the next rung.
 */
export const LADDER_MATCH_TOLERANCE_KG = 0.1

/** The ladder of an equipment's category, in kg — or `null` when it has none. */
export function resolveLoadLadder(
  equipment: string | undefined,
  unit: WeightUnit,
): number[] | null {
  const category = equipment ? LOAD_LADDER_CATEGORY[equipment] : null
  if (!category) return null
  return LOAD_LADDERS_KG[unit][category] ?? null
}

/**
 * Ceiling on a **Load Jump**, as a ratio of the current load: above it the
 * engine refuses the step and escalates to `SETS_UP` instead. A starting
 * guess, to recalibrate post-launch like `STALL_SESSIONS`.
 */
export const LOAD_JUMP_MAX_RATIO = 0.30

/**
 * The first rung **strictly** above `currentKg` (within
 * {@link LADDER_MATCH_TOLERANCE_KG}), or `null` when there is none — the
 * caller then falls back to the legacy increment.
 */
export function nextLoad(ladder: number[], currentKg: number): number | null {
  return ladder.find((step) => step > currentKg + LADDER_MATCH_TOLERANCE_KG) ?? null
}

/**
 * The last rung **strictly** below `currentKg` (within
 * {@link LADDER_MATCH_TOLERANCE_KG}), or `null` at the first rung / without a
 * ladder — the caller then falls back to the legacy increment. The **Deload**
 * reads it to step down onto a load the athlete can actually compose.
 */
export function previousLoad(
  ladder: number[] | null,
  currentKg: number,
): number | null {
  if (!ladder) return null
  return (
    ladder.filter((step) => step < currentKg - LADDER_MATCH_TOLERANCE_KG).at(-1) ??
    null
  )
}

/**
 * The relative **Load Jump** from `fromKg` to `toKg`. `Infinity` when there is
 * no load to jump from: a step off zero is always refused.
 */
export function loadJumpRatio(fromKg: number, toKg: number): number {
  if (fromKg <= 0) return Infinity
  return (toKg - fromKg) / fromKg
}
