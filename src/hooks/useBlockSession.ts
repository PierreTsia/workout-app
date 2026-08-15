import { useCallback, useMemo, useState } from "react"
import { useAtomValue } from "jotai"
import { useQueryClient } from "@tanstack/react-query"
import { authAtom } from "@/store/atoms"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import { useBlockRunner, type UseBlockRunner } from "@/hooks/useBlockRunner"
import { useBlockRun } from "@/hooks/useBlockRun"
import {
  discardBlockSetLogs,
  enqueueSetLog,
  peekSessionRealId,
  queuedSetLogPayloadsForSession,
  scheduleImmediateDrain,
} from "@/lib/syncService"
import type { SetLogPayload } from "@/lib/syncService"
import type { SetLog } from "@/types/database"
import {
  blockCellKey,
  blockSetNumber,
  buildBlockSetLogPayload,
  loggedBlockCells,
} from "@/lib/blockSetLog"
import {
  runnerStateFromLogs,
  type BlockRunnerContext,
  type Cursor,
} from "@/lib/blockRunner"
import type { ExerciseBlockWithExercises } from "@/types/database"

export interface AmrapDisplayScore {
  fullRounds: number
  leftover: number
  leftoverName: string
}

export interface UseBlockSession extends UseBlockRunner {
  /** `blockCellKey`s already persisted this session — for resume / cancel UI. */
  loggedCells: Set<string>
  /** Cancel the whole block: wipe its set_logs (queued + persisted) this session. */
  discardBlock: () => Promise<void>
  startedAt: number | null
  finishedAt: number | null
  hydratePending: boolean
  stampGo: (at: number) => void
  stampFinish: (at: number) => void
  amrapScore: AmrapDisplayScore | null
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
  const queuedCells = useMemo(() => {
    const ids = new Set(block.exercises.map((e) => e.id))
    return new Set(
      queuedSetLogPayloadsForSession(localSessionId)
        .filter(
          (p): p is typeof p & { blockExerciseId: string } =>
            p.blockExerciseId != null && ids.has(p.blockExerciseId),
        )
        .map((p) => blockCellKey(p.blockExerciseId, p.setNumber)),
    )
  }, [block, localSessionId])
  const [optimisticCells, setOptimisticCells] = useState<Set<string>>(
    () => new Set(),
  )
  const [leftoverActual, setLeftoverActual] = useState<number | null>(null)
  const loggedCells = useMemo(
    () => new Set([...persistedCells, ...queuedCells, ...optimisticCells]),
    [persistedCells, queuedCells, optimisticCells],
  )

  const ctx: BlockRunnerContext = useMemo(
    () => ({
      rounds: block.rounds,
      exerciseCount: block.exercises.length,
      transitionSeconds: block.transition_seconds,
      restSeconds: block.rest_seconds,
      mode: block.mode,
    }),
    [block],
  )

  const onLog = useCallback(
    (cursor: Cursor, actual?: number) => {
      const blockExercise = block.exercises[cursor.exerciseIdx]
      if (!blockExercise) return
      // Idempotent: navigating back onto an already-validated cell and advancing
      // again must not enqueue a duplicate set_log (#351).
      const key = blockCellKey(blockExercise.id, blockSetNumber(cursor.round))
      if (loggedCells.has(key)) return
      if (actual != null) setLeftoverActual(actual)
      setOptimisticCells((prev) => new Set(prev).add(key))
      enqueueSetLog(
        buildBlockSetLogPayload({
          sessionId: localSessionId,
          blockExercise,
          round: cursor.round,
          now: Date.now(),
          mode: block.mode,
          actual,
        }),
      )
      scheduleImmediateDrain()
      if (realId) {
        queryClient.invalidateQueries({ queryKey: ["session-set-logs", realId] })
      }
    },
    [block, localSessionId, realId, queryClient, loggedCells],
  )

  const {
    startedAt,
    finishedAt,
    hydratePending,
    stampGo,
    stampFinish,
    discardRun,
  } = useBlockRun(block, localSessionId)

  const runner = useBlockRunner({
    ctx,
    onLog,
    initialState: runnerStateFromLogs(
      loggedCells,
      block.exercises.map((e) => e.id),
      { finished: finishedAt != null },
    ),
  })

  const lastLogged =
    runner.state.phase === "done"
      ? runner.state.lastLogged
      : runner.state.phase === "leftover"
        ? runner.state.cursor
        : null

  const amrapScore = useMemo((): AmrapDisplayScore | null => {
    if (block.mode !== "amrap" || lastLogged == null) return null
    const ex = block.exercises[lastLogged.exerciseIdx]
    if (!ex) return null
    const setNumber = blockSetNumber(lastLogged.round)
    const queued = queuedSetLogPayloadsForSession(localSessionId).find(
      (p) => p.blockExerciseId === ex.id && p.setNumber === setNumber,
    )
    const persisted = (setLogs ?? []).find(
      (log) => log.block_exercise_id === ex.id && log.set_number === setNumber,
    )
    return {
      fullRounds: lastLogged.round,
      leftover:
        leftoverActual ??
        (queued
          ? actualFromPayload(queued)
          : persisted
            ? actualFromSetLog(persisted)
            : 0),
      leftoverName: ex.name_snapshot,
    }
  }, [block, lastLogged, localSessionId, setLogs, leftoverActual])

  const discardBlock = useCallback(async () => {
    setOptimisticCells(new Set())
    setLeftoverActual(null)
    await discardRun()
    const sessionId = userId
      ? peekSessionRealId(userId, localSessionId)
      : realId
    if (sessionId) {
      await discardBlockSetLogs(
        sessionId,
        block.exercises.map((e) => e.id),
      )
      queryClient.invalidateQueries({ queryKey: ["session-set-logs", sessionId] })
    }
  }, [discardRun, userId, localSessionId, realId, block, queryClient])

  return {
    ...runner,
    loggedCells,
    discardBlock,
    startedAt,
    finishedAt,
    hydratePending,
    stampGo,
    stampFinish,
    amrapScore,
  }
}

function actualFromPayload(payload: SetLogPayload): number {
  return "durationSeconds" in payload
    ? payload.durationSeconds
    : Number.parseInt(payload.repsLogged, 10) || 0
}

function actualFromSetLog(log: SetLog): number {
  if (log.duration_seconds != null) return log.duration_seconds
  if (log.reps_logged == null) return 0
  return Number.parseInt(log.reps_logged, 10) || 0
}
