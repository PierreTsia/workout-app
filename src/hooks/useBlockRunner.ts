import { useCallback, useEffect, useReducer } from "react"
import { useNow } from "@/hooks/useNow"
import {
  blockRunnerReducer,
  initialRunnerState,
  type BlockRunnerContext,
  type Cursor,
  type RunnerEvent,
  type RunnerState,
} from "@/lib/blockRunner"

interface UseBlockRunnerArgs {
  ctx: BlockRunnerContext
  /** Called with the current cell when the user logs it (wire to set_logs). */
  onLog?: (cursor: Cursor, actual?: number) => void
  /** Called with the current cell when the user cancels its log. */
  onCancelLog?: (cursor: Cursor) => void
  initialState?: RunnerState
}

export interface UseBlockRunner {
  state: RunnerState
  /** Whole seconds left on the active transition/rest timer, else `null`. */
  remainingSeconds: number | null
  logAndAdvance: (actual?: number) => void
  skip: () => void
  goBack: () => void
  cancelLog: () => void
  timeOut: () => void
  terminate: () => void
}

const TICK_MS = 250

export function useBlockRunner({
  ctx,
  onLog,
  onCancelLog,
  initialState,
}: UseBlockRunnerArgs): UseBlockRunner {
  const [state, dispatch] = useReducer(
    (s: RunnerState, e: RunnerEvent) => blockRunnerReducer(s, e, ctx, Date.now()),
    initialState ?? initialRunnerState(),
  )

  const endsAt =
    state.phase === "transition" || state.phase === "roundRest"
      ? state.endsAt
      : null

  const now = useNow(endsAt != null, TICK_MS)

  // Fire TIMER_DONE once the armed deadline has passed. The clock itself comes
  // from `useNow`; this only reacts to it (dispatch is not a cascading render).
  useEffect(() => {
    if (endsAt != null && now >= endsAt) dispatch({ type: "TIMER_DONE" })
  }, [endsAt, now])

  const remainingSeconds =
    endsAt == null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000))

  const logAndAdvance = useCallback(
    (actual?: number) => {
      if (state.phase !== "exercise" && state.phase !== "leftover") return
      onLog?.(state.cursor, actual)
      dispatch({ type: "LOG_AND_ADVANCE" })
    },
    [state, onLog],
  )

  const cancelLog = useCallback(() => {
    if (state.phase !== "exercise") return
    onCancelLog?.(state.cursor)
    dispatch({ type: "CANCEL_LOG" })
  }, [state, onCancelLog])

  const skip = useCallback(() => dispatch({ type: "SKIP" }), [])
  const goBack = useCallback(() => dispatch({ type: "GO_BACK" }), [])
  const timeOut = useCallback(() => dispatch({ type: "TIME" }), [])
  const terminate = useCallback(() => dispatch({ type: "TERMINATE" }), [])

  return {
    state,
    remainingSeconds,
    logAndAdvance,
    skip,
    goBack,
    cancelLog,
    timeOut,
    terminate,
  }
}
