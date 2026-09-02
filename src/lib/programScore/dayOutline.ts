import type {
  ProgramDayOutline,
  ProgramDayPreviewItem,
  SlimDayRow,
} from "./types"

export function formatDayOutlineCaption(day: ProgramDayOutline): string {
  const mark = day.emoji.trim()
  const name = day.label.trim()
  if (name === "") return mark
  return mark === "" ? name : `${mark} ${name}`
}

export function formatDayOutlineLine(
  days: readonly ProgramDayOutline[],
): string {
  return days
    .map(formatDayOutlineCaption)
    .filter((caption) => caption.length > 0)
    .join(" · ")
}

function previewItems(day: SlimDayRow): readonly ProgramDayPreviewItem[] {
  const solos: ProgramDayPreviewItem[] = day.workout_exercises.map(
    (exercise, index) => ({
      kind: "solo",
      id: exercise.id ?? `${day.id}-solo-${index}`,
      emoji: (exercise.emoji_snapshot ?? exercise.exercise?.emoji ?? "").trim(),
      name_snapshot: exercise.name_snapshot ?? "",
      exercise:
        exercise.exercise != null
          ? {
              name: exercise.exercise.name ?? null,
              name_en: exercise.exercise.name_en ?? null,
            }
          : null,
      sets: exercise.sets,
      reps: exercise.reps,
      sortOrder: exercise.sort_order ?? index,
    }),
  )

  const circuits: ProgramDayPreviewItem[] = (day.exercise_blocks ?? []).map(
    (block, index) => ({
      kind: "circuit",
      id: block.id ?? `${day.id}-circuit-${index}`,
      label: block.label ?? null,
      rounds: block.rounds ?? 0,
      exerciseCount: block.exercises.length,
      sortOrder: block.sort_order ?? index,
    }),
  )

  return [...solos, ...circuits].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function outlineDaysFromRows(
  rows: readonly SlimDayRow[],
): readonly ProgramDayOutline[] {
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((day) => ({
      id: day.id,
      emoji: day.emoji,
      label: day.label,
      items: previewItems(day),
    }))
}
