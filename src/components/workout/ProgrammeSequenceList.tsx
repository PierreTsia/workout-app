import { useTranslation } from "react-i18next"
import { Layers } from "lucide-react"
import { AmrapLabel } from "@/components/circuit/AmrapLabel"
import { Card, CardContent } from "@/components/ui/card"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { formatDurationShort } from "@/lib/formatters"
import { buildDayItems } from "@/lib/dayItems"
import type {
  ExerciseBlockWithExercises,
  WorkoutExerciseWithLabel,
} from "@/types/database"

function ProgrammeBlockCard({ block }: { block: ExerciseBlockWithExercises }) {
  const { t } = useTranslation("builder")
  const { exerciseName } = useCatalogLabels()
  const amrapMinutes =
    block.mode === "amrap" && block.cap_seconds !== null
      ? block.cap_seconds / 60
      : null

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{block.label ?? t("blockDefaultLabel")}</span>
        </div>
        {amrapMinutes !== null ? (
          <AmrapLabel minutes={amrapMinutes} />
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("blockRounds", { count: block.rounds })}
          </span>
        )}
        <ul className="flex flex-col gap-1">
          {block.exercises.map((be) => (
            <li
              key={be.id}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span>{be.emoji_snapshot}</span>
              <span>{exerciseName(be)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function ProgrammeSoloRow({ exercise }: { exercise: WorkoutExerciseWithLabel }) {
  const { exerciseName } = useCatalogLabels()
  const duration = exercise.target_duration_seconds
  const hasDuration = duration != null && duration > 0
  const prescription = hasDuration
    ? formatDurationShort(duration)
    : `${exercise.sets} × ${exercise.reps}`

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <span className="text-2xl leading-none">{exercise.emoji_snapshot}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {exerciseName(exercise)}
          </p>
          <p className="text-xs text-muted-foreground">{prescription}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function ProgrammeSequenceList({
  exercises,
  blocks,
}: {
  exercises: WorkoutExerciseWithLabel[]
  blocks: ExerciseBlockWithExercises[]
}) {
  const items = buildDayItems(exercises, blocks)

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) =>
        item.kind === "block" ? (
          <ProgrammeBlockCard key={item.block.id} block={item.block} />
        ) : (
          <ProgrammeSoloRow key={item.exercise.id} exercise={item.exercise} />
        ),
      )}
    </div>
  )
}
