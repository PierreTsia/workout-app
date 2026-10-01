import { useAtom } from "jotai"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sessionAtom } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"
import { Button } from "@/components/ui/button"

interface SessionNavProps {
  exercises: WorkoutExercise[]
  /**
   * Total slots in the unified sequence (solos + blocks). Bounds Prev/Next.
   * Defaults to `exercises.length` when the day has no blocks.
   */
  itemCount?: number
  /** Runs the shared finish attempt (`useFinishSessionAttempt`), which owns the confirm dialog. */
  onFinishAttempt: () => void
  /** When the workout timer is paused, forward/next attempts call this instead. */
  onBlockedByPause?: () => void
}

export function SessionNav({
  exercises,
  itemCount,
  onFinishAttempt,
  onBlockedByPause,
}: SessionNavProps) {
  const { t } = useTranslation("workout")
  const [session, setSession] = useAtom(sessionAtom)

  const total = itemCount ?? exercises.length
  const isFirst = session.exerciseIndex === 0
  const isLast = session.exerciseIndex >= total - 1

  function prev() {
    if (isFirst) return
    setSession((s) => ({ ...s, exerciseIndex: s.exerciseIndex - 1 }))
  }

  function next() {
    if (session.pausedAt != null) {
      onBlockedByPause?.()
      return
    }
    if (isLast) {
      onFinishAttempt()
      return
    }
    setSession((s) => ({ ...s, exerciseIndex: s.exerciseIndex + 1 }))
  }

  return (
    <div className="sticky bottom-0 shrink-0 border-t border-border bg-background px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          size="lg"
          onClick={prev}
          disabled={isFirst}
          className="flex-1"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t("previous")}
        </Button>
        <Button size="lg" onClick={next} className="flex-1">
          {isLast ? t("finish") : t("next")}
          {!isLast && <ChevronRight className="ml-1 h-4 w-4" />}
        </Button>
      </div>
      {!isLast && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onFinishAttempt}
          className="mt-2 w-full text-muted-foreground"
        >
          {t("finishEarly")}
        </Button>
      )}
    </div>
  )
}
