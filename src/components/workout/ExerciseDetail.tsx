import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { EllipsisVertical, Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLastSession } from "@/hooks/useLastSession"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import type { Exercise, WorkoutExercise } from "@/types/database"
import { ExerciseInstructionsPanel } from "@/components/exercise/ExerciseInstructionsPanel"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { AdminOnly } from "@/components/admin/AdminOnly"
import { FeedbackSheet } from "@/components/feedback/FeedbackSheet"
import { BodyMap } from "@/components/body-map/BodyMap"
import { ExerciseSwapInlinePanel } from "@/components/workout/ExerciseSwapInlinePanel"
import { SetsTable } from "./SetsTable"

export interface ExerciseDetailEditSessionProps {
  exercisePool: Exercise[]
  poolLoading: boolean
  allExercises: WorkoutExercise[]
  onSwapExerciseChosen: (row: WorkoutExercise, picked: Exercise) => void
  onDeleteRequested: (row: WorkoutExercise) => void
  onSwapBrowseLibrary: (row: WorkoutExercise) => void
}

interface ExerciseDetailProps {
  exercise: WorkoutExercise
  sessionId: string
  isReadOnly: boolean
  editSession?: ExerciseDetailEditSessionProps | null
}

export function ExerciseDetail({
  exercise,
  sessionId,
  isReadOnly,
  editSession = null,
}: ExerciseDetailProps) {
  const { t } = useTranslation("workout")
  const { t: tFeedback } = useTranslation("feedback")
  const { formatWeight } = useWeightUnit()
  const { data: lastSession } = useLastSession(exercise.exercise_id)
  const { data: libExercise } = useExerciseFromLibrary(exercise.exercise_id)
  const [swapPanelOpen, setSwapPanelOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const showWorkoutEdits = Boolean(editSession && !isReadOnly)

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <ExerciseThumbnail imageUrl={libExercise?.image_url} emoji={exercise.emoji_snapshot} className="h-10 w-10" />
          <h2 className="min-w-0 flex-1 text-xl font-bold">{exercise.name_snapshot}</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={editSession ? editSession.poolLoading : false}
                aria-label={t("preSession.rowActionsLabel")}
              >
                <EllipsisVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <AdminOnly>
                <DropdownMenuItem asChild>
                  <Link
                    to={`/admin/exercises/${exercise.exercise_id}`}
                    className="flex cursor-default items-center gap-2"
                  >
                    <Pencil className="h-4 w-4 shrink-0" />
                    {t("session.menuEditInAdmin")}
                  </Link>
                </DropdownMenuItem>
              </AdminOnly>
              <DropdownMenuItem
                onSelect={() => {
                  setFeedbackOpen(true)
                }}
              >
                {tFeedback("reportButton")}
              </DropdownMenuItem>
              {showWorkoutEdits ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      setSwapPanelOpen(true)
                    }}
                  >
                    {t("preSession.swap")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      if (editSession) editSession.onDeleteRequested(exercise)
                    }}
                  >
                    {t("preSession.delete")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {showWorkoutEdits && swapPanelOpen && editSession ? (
          <ExerciseSwapInlinePanel
            exercise={exercise}
            exercisePool={editSession.exercisePool}
            currentExerciseIds={editSession.allExercises.map((e) => e.exercise_id)}
            onSwapExerciseChosen={editSession.onSwapExerciseChosen}
            onSwapBrowseLibrary={editSession.onSwapBrowseLibrary}
            onDismiss={() => setSwapPanelOpen(false)}
          />
        ) : null}
        <Badge variant="secondary" className="w-fit text-xs">
          {exercise.muscle_snapshot}
        </Badge>
        {lastSession && (
          <p className="text-sm text-muted-foreground">
            {t("lastTime", {
              sets: lastSession.sets,
              reps: lastSession.reps,
              weight: formatWeight(lastSession.weight),
            })}
          </p>
        )}
      </div>

      <FeedbackSheet
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        exerciseId={exercise.exercise_id}
        sourceScreen="workout"
        onSuccess={() => setFeedbackOpen(false)}
      />

      <BodyMap
        muscleGroup={libExercise?.muscle_group ?? exercise.muscle_snapshot}
        secondaryMuscles={libExercise?.secondary_muscles}
      />

      <ExerciseInstructionsPanel exerciseId={exercise.exercise_id} />

      <SetsTable exercise={exercise} sessionId={sessionId} isReadOnly={isReadOnly} equipment={libExercise?.equipment} />
    </div>
  )
}
