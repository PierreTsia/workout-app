import { parseTargetRepRange } from "@/lib/rirSuggestion"
import { MUSCLE_TAXONOMY } from "@/lib/trainingBalance"
import type {
  IntentCircuit,
  IntentSolo,
  IntentStation,
  MeasurementType,
  ProgramIntent,
  SlimCircuitRow,
  SlimDayRow,
  SlimExerciseEmbed,
  SlimSoloRow,
  SlimStationRow,
} from "./types"

const TAXONOMY = new Set<string>(MUSCLE_TAXONOMY)

function knownMuscle(slug: string | null | undefined): string | null {
  if (slug == null || !TAXONOMY.has(slug)) return null
  return slug
}

function resolveMuscle(
  exercise: SlimExerciseEmbed | null,
  snapshot: string,
): string | null {
  return knownMuscle(exercise?.muscle_group ?? snapshot)
}

function resolveSecondaries(
  exercise: SlimExerciseEmbed | null,
): readonly string[] {
  return (exercise?.secondary_muscles ?? [])
    .map(knownMuscle)
    .filter((muscle): muscle is string => muscle != null)
}

function resolveEquipment(exercise: SlimExerciseEmbed | null): string {
  return exercise?.equipment ?? "other"
}

function resolveMeasurement(
  exercise: SlimExerciseEmbed | null,
): MeasurementType {
  return exercise?.measurement_type ?? "reps"
}

function toSolo(row: SlimSoloRow): IntentSolo {
  const range = parseTargetRepRange(row)
  return {
    sets: row.sets,
    restSeconds: row.rest_seconds,
    repMax: range?.max ?? null,
    measurementType: resolveMeasurement(row.exercise),
    primaryMuscle: resolveMuscle(row.exercise, row.muscle_snapshot),
    secondaryMuscles: resolveSecondaries(row.exercise),
    equipment: resolveEquipment(row.exercise),
  }
}

function toStation(row: SlimStationRow): IntentStation {
  return {
    primaryMuscle: resolveMuscle(row.exercise, row.muscle_snapshot),
    secondaryMuscles: resolveSecondaries(row.exercise),
    equipment: resolveEquipment(row.exercise),
  }
}

function toCircuit(row: SlimCircuitRow): IntentCircuit {
  return {
    mode: row.mode,
    capSeconds: row.cap_seconds,
    stations: row.exercises.map(toStation),
  }
}

export function toIntent(
  programId: string,
  days: readonly SlimDayRow[],
): ProgramIntent {
  return {
    programId,
    days: [...days]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((day) => ({
        id: day.id,
        label: day.label,
        sortOrder: day.sort_order,
        solos: day.workout_exercises.map(toSolo),
        circuits: (day.exercise_blocks ?? []).map(toCircuit),
      })),
  }
}
