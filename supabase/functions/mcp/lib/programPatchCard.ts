/**
 * The structured program carried by `update_program`'s `dry_run` `structuredContent`
 * (ADR 0031). Pure and side-effect-free: it maps the already-computed `ProgramDiff`
 * plus the current snapshot to a typed program the **Decision Card** can render —
 * days, typed exercises, and the fields that changed on each matched solo.
 *
 * It is additive and never authoritative: the markdown `rendered` and the apply path
 * stay the source of truth. Change detection is a UI heuristic (match by
 * `exercise_id`, order fallback).
 */

import type { ParsedExercise } from "./createProgramValidation.ts"
import type { CatalogExerciseForProgram } from "./programPersistence.ts"
import { reconcileSolos } from "./slotReconciliation.ts"
import type {
  CurrentProgramSnapshot,
  CurrentProgramSnapshotDay,
  CurrentProgramSnapshotExercise,
  DiffDayInsert,
  DiffDayUpdate,
  ProgramDiff,
} from "./updateProgramTypes.ts"

export type PatchLocale = "en" | "fr"
export type PatchChangeField = "sets" | "reps" | "weight" | "rest"

export type PatchSoloExercise = {
  kind: "solo"
  name: string
  sets: number
  reps: string
  weightKg: number
  restSeconds: number
  targetDurationSeconds: number | null
  isNew: boolean
  change: PatchChangeField[] | null
}

export type PatchCircuitExercise = {
  kind: "circuit"
  label: string
  mode: "rounds" | "amrap"
  capSeconds: number | null
  rounds: number
  exerciseCount: number
  isNew: boolean
}

export type PatchExercise = PatchSoloExercise | PatchCircuitExercise

export type PatchDay = { label: string; emoji: string; exercises: PatchExercise[] }

export type PatchProgram = { name: string; days: PatchDay[] }

const DEFAULT_INSERT_EMOJI = "🏋️"
const DEFAULT_CIRCUIT_LABEL = "Circuit"
const DEFAULT_AMRAP_CAP_MINUTES = 20
const BARE_DEFAULTS = { sets: 3, reps: "10", weightKg: 0, restSeconds: 90 } as const

const normalizeReps = (value: string): string => value.trim().toLowerCase()

function toNumber(value: string): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function changedFields(
  existing: CurrentProgramSnapshotExercise,
  parsed: Extract<ParsedExercise, { kind: "object" }>,
): PatchChangeField[] | null {
  const change: PatchChangeField[] = []
  if (parsed.sets !== existing.sets) change.push("sets")
  if (normalizeReps(parsed.reps) !== normalizeReps(existing.reps)) change.push("reps")
  if (parsed.weightKg !== toNumber(existing.weight)) change.push("weight")
  if (parsed.restSeconds !== existing.rest_seconds) change.push("rest")
  return change.length > 0 ? change : null
}

function soloFromParsed(
  parsed: Extract<ParsedExercise, { kind: "bare" | "object" }>,
  catalogById: Map<string, CatalogExerciseForProgram>,
  existing: CurrentProgramSnapshotExercise | undefined,
): PatchSoloExercise {
  const catalog = catalogById.get(parsed.exerciseId)
  const name = catalog?.name ?? existing?.name_snapshot ?? "(unknown exercise)"

  if (parsed.kind === "bare") {
    return {
      kind: "solo",
      name,
      ...BARE_DEFAULTS,
      targetDurationSeconds: null,
      isNew: existing === undefined,
      change: null,
    }
  }

  return {
    kind: "solo",
    name,
    sets: parsed.sets,
    reps: parsed.reps,
    weightKg: parsed.weightKg,
    restSeconds: parsed.restSeconds,
    targetDurationSeconds: parsed.targetDurationSeconds,
    isNew: existing === undefined,
    change: existing ? changedFields(existing, parsed) : null,
  }
}

function circuitFromParsed(
  parsed: Extract<ParsedExercise, { kind: "circuit" }>,
  isNew: boolean,
): PatchCircuitExercise {
  const mode = parsed.mode ?? "rounds"
  return {
    kind: "circuit",
    label: parsed.label?.trim() || DEFAULT_CIRCUIT_LABEL,
    mode,
    capSeconds:
      mode === "amrap" ? (parsed.capMinutes ?? DEFAULT_AMRAP_CAP_MINUTES) * 60 : null,
    rounds: parsed.rounds,
    exerciseCount: parsed.exercises.length,
    isNew,
  }
}

function buildUpdatedDay(
  update: DiffDayUpdate,
  current: CurrentProgramSnapshotDay | undefined,
  catalogById: Map<string, CatalogExerciseForProgram>,
): PatchDay {
  const existing = current?.workout_exercises ?? []
  const { matched } = reconcileSolos(existing, update.parsed_exercises)
  const matchedByIndex = new Map(matched.map((m) => [m.index, m.existing]))

  const exercises = update.parsed_exercises.map((parsed, index): PatchExercise =>
    parsed.kind === "circuit"
      ? circuitFromParsed(parsed, false)
      : soloFromParsed(parsed, catalogById, matchedByIndex.get(index)),
  )

  return { label: update.label, emoji: update.emoji, exercises }
}

function buildInsertedDay(
  insert: DiffDayInsert,
  catalogById: Map<string, CatalogExerciseForProgram>,
): PatchDay {
  const exercises = insert.parsed_exercises.map((parsed): PatchExercise =>
    parsed.kind === "circuit"
      ? circuitFromParsed(parsed, true)
      : soloFromParsed(parsed, catalogById, undefined),
  )
  return { label: insert.label, emoji: insert.emoji ?? DEFAULT_INSERT_EMOJI, exercises }
}

function buildUnchangedDay(
  day: CurrentProgramSnapshotDay,
  catalogById: Map<string, CatalogExerciseForProgram>,
): PatchDay {
  const exercises = [...day.workout_exercises]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (ex): PatchSoloExercise => ({
        kind: "solo",
        name: catalogById.get(ex.exercise_id)?.name ?? ex.name_snapshot,
        sets: ex.sets,
        reps: ex.reps,
        weightKg: toNumber(ex.weight) ?? 0,
        restSeconds: ex.rest_seconds,
        targetDurationSeconds: ex.target_duration_seconds,
        isNew: false,
        change: null,
      }),
    )
  return { label: day.label, emoji: day.emoji, exercises }
}

export function buildPatchProgram(
  diff: ProgramDiff,
  current: CurrentProgramSnapshot,
  catalogById: Map<string, CatalogExerciseForProgram>,
): PatchProgram {
  const currentById = new Map(current.days.map((day) => [day.id, day]))

  const ordered: Array<{ sort_order: number; day: PatchDay }> = [
    ...diff.days_to_update.map((u) => ({
      sort_order: u.sort_order,
      day: buildUpdatedDay(u, currentById.get(u.id), catalogById),
    })),
    ...diff.days_to_insert.map((i) => ({
      sort_order: i.sort_order,
      day: buildInsertedDay(i, catalogById),
    })),
    ...diff.days_unchanged.flatMap((u) => {
      const day = currentById.get(u.id)
      return day ? [{ sort_order: day.sort_order, day: buildUnchangedDay(day, catalogById) }] : []
    }),
  ].sort((a, b) => a.sort_order - b.sort_order)

  return {
    name: diff.name_change?.to ?? current.name,
    days: ordered.map((entry) => entry.day),
  }
}
