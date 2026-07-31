import { formatDurationShort, formatSecondsMMSS } from "@/lib/formatters"
import { groupBy } from "@/lib/utils"
import type { CatalogNameSource } from "@/lib/catalogLabels"
import type {
  SetLog,
  SetLogWithExercise,
  WorkoutExerciseWithLabel,
} from "@/types/database"

function setLogDisplayValue(log: SetLog): string {
  if (log.duration_seconds != null) {
    return formatSecondsMMSS(log.duration_seconds)
  }
  return log.reps_logged ?? ""
}

function repsRangeLabel(
  values: string[],
  mode: "reps" | "duration",
): string {
  const unique = [...new Set(values)]
  if (unique.length === 1) return unique[0]

  if (mode === "duration") {
    const asDurationSec = unique.map((s) => {
      const parts = s.split(":")
      if (parts.length === 2) {
        const m = Number(parts[0])
        const sec = Number(parts[1])
        if (!Number.isNaN(m) && !Number.isNaN(sec)) return m * 60 + sec
      }
      const n = Number(s)
      return Number.isNaN(n) ? NaN : n
    })
    if (asDurationSec.every((n) => !Number.isNaN(n))) {
      const lo = Math.min(...asDurationSec)
      const hi = Math.max(...asDurationSec)
      return lo === hi
        ? formatSecondsMMSS(lo)
        : `${formatSecondsMMSS(lo)}–${formatSecondsMMSS(hi)}`
    }
  }

  const nums = unique.map(Number).filter((n) => !Number.isNaN(n))
  if (nums.length === unique.length) {
    return `${Math.min(...nums)}–${Math.max(...nums)}`
  }
  return unique.join("–")
}

/**
 * Carries the name *source* rather than a name: the recap is rendered in the
 * reader's language (ADR 0010), which these builders have no business knowing.
 * `ExerciseListPreview` resolves it via `useCatalogLabels`.
 */
export interface ExercisePreviewItem extends CatalogNameSource {
  id: string
  emoji: string
  sets: number
  reps: string
  maxWeight: number
}

/**
 * Builds preview items from actual session logs, using the template exercises
 * for emoji and sort order (which set_logs don't carry).
 * Exercises that appear in logs but not in the template are appended at the end.
 */
export function summarizeSessionLogs(
  logs: SetLogWithExercise[],
  templateExercises: WorkoutExerciseWithLabel[],
): ExercisePreviewItem[] {
  const logsByExercise = groupBy(logs, (log) => log.exercise_id)

  const grouped = new Map(
    [...logsByExercise].map(([exerciseId, exerciseLogs]) => [
      exerciseId,
      {
        exercise: exerciseLogs[0].exercise,
        exercise_name_snapshot: exerciseLogs[0].exercise_name_snapshot,
        reps: exerciseLogs.map(setLogDisplayValue),
        maxWeight: Math.max(...exerciseLogs.map((l) => l.weight_logged)),
        hasDuration: exerciseLogs.some((l) => l.duration_seconds != null),
      },
    ]),
  )

  const emojiByExerciseId = new Map(
    templateExercises.map((ex) => [ex.exercise_id, ex.emoji_snapshot]),
  )
  const orderByExerciseId = new Map(
    templateExercises.map((ex) => [ex.exercise_id, ex.sort_order]),
  )

  const items: ExercisePreviewItem[] = [...grouped].map(
    ([exerciseId, entry]) => ({
      id: exerciseId,
      emoji: emojiByExerciseId.get(exerciseId) ?? "🏋️",
      exercise: entry.exercise,
      exercise_name_snapshot: entry.exercise_name_snapshot,
      sets: entry.reps.length,
      reps: repsRangeLabel(
        entry.reps,
        entry.hasDuration ? "duration" : "reps",
      ),
      maxWeight: entry.maxWeight,
    }),
  )

  items.sort(
    (a, b) =>
      (orderByExerciseId.get(a.id) ?? Infinity) -
      (orderByExerciseId.get(b.id) ?? Infinity),
  )

  return items
}

/** Converts template exercises into the same preview shape. */
export function templateToPreviewItems(
  exercises: WorkoutExerciseWithLabel[],
): ExercisePreviewItem[] {
  return exercises.map((ex) => {
    const duration = ex.target_duration_seconds
    const hasDuration = duration != null && duration > 0
    return {
      id: ex.id,
      emoji: ex.emoji_snapshot,
      exercise: ex.exercise,
      name_snapshot: ex.name_snapshot,
      sets: ex.sets,
      reps: hasDuration ? formatDurationShort(duration) : ex.reps,
      maxWeight: Number(ex.weight),
    }
  })
}
