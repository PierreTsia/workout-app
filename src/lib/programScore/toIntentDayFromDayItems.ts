import { toCircuit, toSolo } from "./toIntent"
import type { ProgramIntentDay, SlimCircuitRow, SlimSoloRow } from "./types"
import type {
  DayItem,
  ExerciseBlockWithExercises,
  WorkoutExerciseWithExercise,
} from "@/types/database"

function toSlimSolo(exercise: WorkoutExerciseWithExercise): SlimSoloRow {
  return {
    sets: exercise.sets,
    rest_seconds: exercise.rest_seconds,
    reps: exercise.reps,
    rep_range_min: exercise.rep_range_min,
    rep_range_max: exercise.rep_range_max,
    muscle_snapshot: exercise.muscle_snapshot,
    exercise: exercise.exercise,
  }
}

function toSlimCircuit(block: ExerciseBlockWithExercises): SlimCircuitRow {
  return {
    mode: block.mode,
    cap_seconds: block.cap_seconds,
    rounds: block.rounds,
    exercises: block.exercises.map((station) => ({
      muscle_snapshot: station.muscle_snapshot,
      exercise: station.exercise,
    })),
  }
}

export function toIntentDayFromDayItems(
  day: { id: string; label: string; sortOrder: number },
  items: readonly DayItem[],
): ProgramIntentDay {
  return {
    id: day.id,
    label: day.label,
    sortOrder: day.sortOrder,
    solos: items.flatMap((item) =>
      item.kind === "solo" ? [toSolo(toSlimSolo(item.exercise))] : [],
    ),
    circuits: items.flatMap((item) =>
      item.kind === "block" ? [toCircuit(toSlimCircuit(item.block))] : [],
    ),
  }
}
