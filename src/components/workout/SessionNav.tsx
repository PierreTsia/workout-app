import { useState } from "react"
import { useAtom } from "jotai"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { sessionAtom } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"
import { Button } from "@/components/ui/button"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SessionNavProps {
  exercises: WorkoutExercise[]
  /**
   * Total slots in the unified sequence (solos + blocks). Bounds Prev/Next.
   * Defaults to `exercises.length` when the day has no blocks.
   */
  itemCount?: number
  /**
   * Number of incomplete circuits remaining in the workout day. Finish must
   * confirm when this is > 0 — circuit progress is invisible to solo `setsData`.
   */
  incompleteBlockCount?: number
  onFinish: () => void
  /** When the workout timer is paused, forward/next/finish attempts call this instead. */
  onBlockedByPause?: () => void
}

export function SessionNav({
  exercises,
  itemCount,
  incompleteBlockCount = 0,
  onFinish,
  onBlockedByPause,
}: SessionNavProps) {
  const { t } = useTranslation("workout")
  const [session, setSession] = useAtom(sessionAtom)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const total = itemCount ?? exercises.length
  const isFirst = session.exerciseIndex === 0
  const isLast = session.exerciseIndex >= total - 1

  function daySets() {
    return exercises.flatMap((ex) => session.setsData[ex.id] ?? [])
  }

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
      handleFinishAttempt()
      return
    }
    setSession((s) => ({ ...s, exerciseIndex: s.exerciseIndex + 1 }))
  }

  function handleFinishAttempt() {
    if (session.pausedAt != null) {
      onBlockedByPause?.()
      return
    }
    const skipped = daySets().filter((s) => !s.done).length
    // Items still ahead (e.g. trailing circuit after a solo), or unfinished
    // blocks skipped via the strip, are not reflected in solo set rows — so
    // "all sets done" must not silently end the session.
    const leavingWork =
      skipped > 0 || !isLast || incompleteBlockCount > 0
    if (leavingWork) {
      setConfirmOpen(true)
    } else {
      onFinish()
    }
  }

  function handleConfirmFinish() {
    setConfirmOpen(false)
    onFinish()
  }

  const skippedCount = daySets().filter((s) => !s.done).length
  const hasRemainingAhead = !isLast || incompleteBlockCount > 0
  const confirmBody =
    skippedCount > 0 && hasRemainingAhead
      ? t("finishEarlySkippedAndRemaining", { count: skippedCount })
      : skippedCount > 0
        ? t("skippedSets", { count: skippedCount })
        : t("finishEarlyRemaining")

  return (
    <>
      <div
        className="sticky bottom-0 border-t border-border bg-background px-4 py-3"
      >
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
          <Button
            size="lg"
            onClick={next}
            className="flex-1"
          >
            {isLast ? t("finish") : t("next")}
            {!isLast && <ChevronRight className="ml-1 h-4 w-4" />}
          </Button>
        </div>
        {!isLast && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFinishAttempt}
            className="mt-2 w-full text-muted-foreground"
          >
            {t("finishEarly")}
          </Button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("finishSessionTitle")}</DialogTitle>
            <DialogDescription>{confirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button onClick={handleConfirmFinish}>{t("finish")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
