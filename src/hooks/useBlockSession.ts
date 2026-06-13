import { useCallback, useMemo } from "react"
import { useAtomValue } from "jotai"
import { useQueryClient } from "@tanstack/react-query"
import { authAtom } from "@/store/atoms"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import { useBlockRunner, type UseBlockRunner } from "@/hooks/useBlockRunner"
import {
  enqueueSetLog,
  peekSessionRealId,
  scheduleImmediateDrain,
} from "@/lib/syncService"
import { buildBlockSetLogPayload, loggedBlockCells } from "@/lib/blockSetLog"
import type { BlockRunnerContext, Cursor } from "@/lib/blockRunner"
import type { ExerciseBlockWithExercises } from "@/types/database"

export interface UseBlockSession extends UseBlockRunner {
  /** `blockCellKey`s already persisted this session — for resume / cancel UI. */
  loggedCells: Set<string>
}

/**
 * Wires the pure {@link useBlockRunner} to persistence: logging a cell enqueues
 * a block-tagged set_log (offline-first, via the existing sync queue) and the
 * "already logged" set is derived from set_logs so a reload resumes correctly.
 *
 * `onCancelLog` (deleting a logged cell mid-run) is intentionally not wired yet
 * — the reducer provisions CANCEL_LOG but offline-safe deletion is T142.
 */
export function useBlockSession(
  block: ExerciseBlockWithExercises,
  localSessionId: string,
): UseBlockSession {
  const userId = useAtomValue(authAtom)?.id ?? null
  const queryClient = useQueryClient()
  // peek (not getSessionRealId) so we don't mint session meta on render; the
  // id appears once the first log is enqueued, which re-renders via runner state.
  const realId = userId ? peekSessionRealId(userId, localSessionId) : null
  const { data: setLogs } = useSessionSetLogs(realId)
  const loggedCells = useMemo(() => loggedBlockCells(setLogs ?? []), [setLogs])

  const ctx: BlockRunnerContext = useMemo(
    () => ({
      rounds: block.rounds,
      exerciseCount: block.exercises.length,
      transitionSeconds: block.transition_seconds,
      restSeconds: block.rest_seconds,
    }),
    [block],
  )

  const onLog = useCallback(
    (cursor: Cursor) => {
      const blockExercise = block.exercises[cursor.exerciseIdx]
      if (!blockExercise) return
      enqueueSetLog(
        buildBlockSetLogPayload({
          sessionId: localSessionId,
          blockExercise,
          round: cursor.round,
          now: Date.now(),
        }),
      )
      scheduleImmediateDrain()
      if (realId) {
        queryClient.invalidateQueries({ queryKey: ["session-set-logs", realId] })
      }
    },
    [block, localSessionId, realId, queryClient],
  )

  const runner = useBlockRunner({ ctx, onLog })

  return { ...runner, loggedCells }
}
