import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAtom } from "jotai"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Bookmark, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { sessionAtom, isQuickWorkoutAtom } from "@/store/atoms"
import {
  useSavedWorkouts,
  type SavedWorkout,
} from "@/hooks/useSavedWorkouts"
import { useDeleteSavedWorkout } from "@/hooks/useDeleteSavedWorkout"
import { useStartSavedWorkout } from "@/hooks/useStartSavedWorkout"

export function SavedWorkoutsSection() {
  const { t } = useTranslation("library")
  const navigate = useNavigate()
  const { data: saved = [] } = useSavedWorkouts()
  const deleteDraft = useDeleteSavedWorkout()
  const startDraft = useStartSavedWorkout()
  const [session, setSession] = useAtom(sessionAtom)
  const [, setIsQuickWorkout] = useAtom(isQuickWorkoutAtom)

  const handleStart = useCallback(
    (dayId: string) => {
      startDraft.mutate(dayId, {
        onSuccess: () => {
          setSession((prev) => ({
            ...prev,
            currentDayId: dayId,
            exerciseIndex: 0,
            setsData: {},
            totalSetsDone: 0,
            isActive: true,
            activeDayId: dayId,
            startedAt: Date.now(),
            pausedAt: null,
            accumulatedPause: 0,
          }))
          setIsQuickWorkout(true)
          navigate("/")
        },
      })
    },
    [startDraft, setSession, setIsQuickWorkout, navigate],
  )

  const handleDelete = useCallback(
    (dayId: string) => {
      deleteDraft.mutate(dayId, {
        onSuccess: () => {
          toast.success(t("draftDeleted"))
        },
      })
    },
    [deleteDraft, t],
  )

  if (saved.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          {t("savedWorkouts")}
        </h2>
      </div>

      {saved.map((w) => (
        <SavedWorkoutCard
          key={w.id}
          workout={w}
          onStart={() => handleStart(w.id)}
          onDelete={() => handleDelete(w.id)}
          isSessionActive={session.isActive}
          isPending={startDraft.isPending || deleteDraft.isPending}
        />
      ))}
    </div>
  )
}

function SavedWorkoutCard({
  workout,
  onStart,
  onDelete,
  isSessionActive,
  isPending,
}: {
  workout: SavedWorkout
  onStart: () => void
  onDelete: () => void
  isSessionActive: boolean
  isPending: boolean
}) {
  const { t } = useTranslation("library")

  const muscles = [
    ...new Set(workout.workout_exercises.map((e) => e.muscle_snapshot)),
  ]

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{workout.label}</span>
          <span className="text-xs text-muted-foreground">
            {workout.workout_exercises.length} {t("exerciseCountLabel")}
            {workout.saved_at &&
              ` · ${t("savedOn", { date: new Date(workout.saved_at).toLocaleDateString() })}`}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            disabled={isPending}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {muscles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {muscles.map((m) => (
            <Badge key={m} variant="secondary" className="text-[10px]">
              {m}
            </Badge>
          ))}
        </div>
      )}

      <Button
        size="sm"
        className="w-full gap-1.5"
        onClick={onStart}
        disabled={isSessionActive || isPending}
      >
        <Play className="h-3.5 w-3.5" />
        {t("startSavedWorkout")}
      </Button>
    </Card>
  )
}
