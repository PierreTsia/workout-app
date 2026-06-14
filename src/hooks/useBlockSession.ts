import { useCallback, useMemo, useState } from "react"
import { useAtomValue } from "jotai"
import { useQueryClient } from "@tanstack/react-query"
import { authAtom } from "@/store/atoms"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import { useBlockRunner, type UseBlockRunner } from "@/hooks/useBlockRunner"
import {
  discardBlockSetLogs,
  enqueueSetLog,
  peekSessionRealId,
  scheduleImmediateDrain,
} from "@/lib/syncService"
import {
  blockCellKey,
  blockSetNumber,
  buildBlockSetLogPayload,
  loggedBlockCells,
} from "@/lib/blockSetLog"
import type { BlockRunnerContext, Cursor } from "@/lib/blockRunner"
import type { ExerciseBlockWithExercises } from "@/types/database"

export interface UseBlockSession extends UseBlockRunner {
  /** `blockCellKey`s already persisted this session — for resume / cancel UI. */
  loggedCells: Set<string>
  /** Cancel the whole block: wipe its set_logs (queued + persisted) this session. */
  discardBlock: () => Promise<void>
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
  // Persisted cells (survive reload). The round-trip (enqueue → drain → refetch)
  // lags behind a tap, so we also keep an optimistic set updated synchronously on
  // log, otherwise going Back immediately wouldn't show the "validated" state (#351).
  const persistedCells = useMemo(
    () => loggedBlockCells(setLogs ?? []),
    [setLogs],
  )
  const [optimisticCells, setOptimisticCells] = useState<Set<string>>(
    () => new Set(),
  )
  const loggedCells = useMemo(
    () => new Set([...persistedCells, ...optimisticCells]),
    [persistedCells, optimisticCells],
  )

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
      // Idempotent: navigating back onto an already-validated cell and advancing
      // again must not enqueue a duplicate set_log (#351).
      const key = blockCellKey(blockExercise.id, blockSetNumber(cursor.round))
      if (loggedCells.has(key)) return
      setOptimisticCells((prev) => new Set(prev).add(key))
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
    [block, localSessionId, realId, queryClient, loggedCells],
  )

  const runner = useBlockRunner({ ctx, onLog })

  const discardBlock = useCallback(async () => {
    setOptimisticCells(new Set())
    if (realId) {
      await discardBlockSetLogs(
        realId,
        block.exercises.map((e) => e.id),
      )
      queryClient.invalidateQueries({ queryKey: ["session-set-logs", realId] })
    }
  }, [realId, block, queryClient])

  return { ...runner, loggedCells, discardBlock }
}
