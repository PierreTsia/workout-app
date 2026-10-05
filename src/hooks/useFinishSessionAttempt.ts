import { useCallback, useState } from "react"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { sessionAtom } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"

interface UseFinishSessionAttemptArgs {
  exercises: WorkoutExercise[]
  /** Total slots in the unified sequence (solos + blocks). Defaults to `exercises.length`. */
  itemCount?: number
  /** Number of incomplete circuits remaining. Circuit progress never lands in solo `setsData`. */
  incompleteBlockCount?: number
  /**
   * Logged sets so far, solos + circuits. `0` means nothing was logged, but it
   * is only trustworthy once the server state is known — the caller must pass
   * `onAbandon` only then (#654).
   */
  setsDone?: number
  onFinish: () => void
  /** When the workout timer is paused, a finish attempt calls this instead. */
  onBlockedByPause?: () => void
  /**
   * Called instead of `onFinish` when nothing was logged and the server state
   * is known. Omitted while session logs are still hydrating (#654).
   */
  onAbandon?: () => void
}

/**
 * The single source of truth for the finish-attempt decision (#571): whether to
 * confirm first (work remains) or finish straight away. Shared by the bottom
 * `SessionNav` and the header `FinishSessionButton`, so the confirm dialog lives
 * in one place (`FinishSessionDialog`, rendered by `WorkoutPage`).
 *
 * Extracted from `SessionNav` (`handleFinishAttempt` + the confirm-body math).
 */
export function useFinishSessionAttempt({
  exercises,
  itemCount,
  incompleteBlockCount = 0,
  setsDone,
  onFinish,
  onBlockedByPause,
  onAbandon,
}: UseFinishSessionAttemptArgs) {
  const { t } = useTranslation("workout")
  const session = useAtomValue(sessionAtom)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const total = itemCount ?? exercises.length
  const isLast = session.exerciseIndex >= total - 1

  const skippedCount = exercises
    .flatMap((ex) => session.setsData[ex.id] ?? [])
    .filter((s) => !s.done).length
  // Items still ahead (e.g. trailing circuit after a solo), or unfinished
  // blocks skipped via the strip, are not in solo set rows — so "all sets done"
  // must not silently end the session.
  const hasRemainingAhead = !isLast || incompleteBlockCount > 0
  const confirmBody =
    skippedCount > 0 && hasRemainingAhead
      ? t("finishEarlySkippedAndRemaining", { count: skippedCount })
      : skippedCount > 0
        ? t("skippedSets", { count: skippedCount })
        : t("finishEarlyRemaining")

  const attempt = useCallback(() => {
    if (session.pausedAt != null) {
      onBlockedByPause?.()
      return
    }
    // Nothing logged: finishing would close an empty session row (#654).
    // Abandon — delete the session and its queue — instead.
    if (setsDone === 0 && onAbandon) {
      onAbandon()
      return
    }
    const leavingWork = skippedCount > 0 || !isLast || incompleteBlockCount > 0
    if (leavingWork) {
      setConfirmOpen(true)
    } else {
      onFinish()
    }
  }, [
    session.pausedAt,
    setsDone,
    onAbandon,
    skippedCount,
    isLast,
    incompleteBlockCount,
    onFinish,
    onBlockedByPause,
  ])

  const confirmFinish = useCallback(() => {
    setConfirmOpen(false)
    onFinish()
  }, [onFinish])

  return { attempt, confirmOpen, setConfirmOpen, confirmBody, confirmFinish }
}
