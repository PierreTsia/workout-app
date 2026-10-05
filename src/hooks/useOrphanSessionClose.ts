import { useCallback, useEffect, useRef, useState } from "react"
import { useAtomValue } from "jotai"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { authAtom, sessionAtom } from "@/store/atoms"
import { computeOrphanClose, type OrphanClose } from "@/lib/orphanSessionClose"
import {
  classifyOpenSession,
  excludedSessionIds,
  fetchOpenSessions,
  type OpenSessionRow,
} from "@/lib/openSessions"
import { resumeOrphanSession } from "@/lib/resumeSession"
import { trackSessionEvent } from "@/lib/sessionEvents"
import { pushAchievementsToQueue } from "@/lib/syncService"
import { grantAchievementsForUser } from "@/lib/grantAchievements"

/** A recent (< 3 h idle) orphan the app-open prompt can offer to resume or finish. */
export interface RecentOrphan {
  id: string
  workoutDayId: string | null
  workoutLabelSnapshot: string | null
  startedAt: string
  cycleId: string | null
  lastSetAt: string
}

export interface UseOrphanSessionCloseResult {
  recentOrphan: RecentOrphan | null
  dismiss: () => void
  resume: () => void
  finish: () => void
}

function invalidateClosedQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["sessions"] })
  queryClient.invalidateQueries({ queryKey: ["sessions-date-range"] })
  queryClient.invalidateQueries({ queryKey: ["training-activity-by-day"] })
  queryClient.invalidateQueries({ queryKey: ["last-session-for-day"] })
  queryClient.invalidateQueries({ queryKey: ["cycle-sessions"] })
}

/** Idempotent close — `.is("finished_at", null)` means it can never touch an already-closed row. */
function closeOpenSession(rowId: string, close: OrphanClose) {
  return supabase
    .from("sessions")
    .update({
      finished_at: close.finishedAt,
      total_sets_done: close.totalSetsDone,
      active_duration_ms: close.activeDurationMs,
      has_skipped_sets: false,
    })
    .eq("id", rowId)
    .is("finished_at", null)
}

/**
 * Self-heals orphan sessions at app open (#568) and surfaces a recent one for
 * the resume/finish prompt (#571).
 *
 * A session whose `finished_at` never landed (user closed the tab before
 * tapping "Terminer") keeps its `set_logs` but stays open — and invisible in
 * History. This hook reads the user's open sessions, closes any whose last set
 * is older than the threshold (writing the last set as `finished_at`, never
 * `now()`), and exposes the most recent still-fresh one as `recentOrphan`.
 *
 * Guards (never close something still alive) live in `excludedSessionIds`:
 * the active local session, the offline queue, and the cancellation deny-list.
 *
 * The UPDATE carries `.is("finished_at", null)`, so it is idempotent and can
 * never touch an already-closed session. Fires at most once per mount.
 */
export function useOrphanSessionClose(): UseOrphanSessionCloseResult {
  const user = useAtomValue(authAtom)
  const session = useAtomValue(sessionAtom)
  const queryClient = useQueryClient()
  const triggeredRef = useRef(false)
  const recentRowRef = useRef<OpenSessionRow | null>(null)
  const [recentOrphan, setRecentOrphan] = useState<RecentOrphan | null>(null)

  const { data } = useQuery<OpenSessionRow[]>({
    queryKey: ["orphan-open-sessions", user?.id],
    enabled: !!user,
    queryFn: () => fetchOpenSessions(user?.id ?? ""),
  })

  useEffect(() => {
    if (triggeredRef.current) return
    if (!user || !data) return
    triggeredRef.current = true

    const excluded = excludedSessionIds(user.id, session)
    const now = Date.now()

    void (async () => {
      let closed = 0
      let recent: { row: OpenSessionRow; lastSetAt: string } | null = null

      for (const row of data) {
        if (excluded.has(row.id)) continue
        const classification = classifyOpenSession(row.set_logs ?? [], now)
        if (!classification) continue

        if (classification.kind === "stale") {
          const { error } = await closeOpenSession(row.id, classification.close)

          if (!error) {
            closed += 1
            trackSessionEvent("session_orphan_closed", {
              cause: "auto",
              session_id: row.id,
              idle_ms: now - Date.parse(classification.close.finishedAt),
              total_sets_done: classification.close.totalSetsDone,
            })
          }
          continue
        }

        if (
          !session.isActive &&
          (!recent || classification.lastSetAt > recent.lastSetAt)
        ) {
          recent = { row, lastSetAt: classification.lastSetAt }
        }
      }

      if (closed > 0) {
        invalidateClosedQueries(queryClient)
        // Credit the recovered sessions' achievements (ADR 0024 amended, #660).
        // One call per boot, not per row; idempotent and non-critical.
        const unlocked = await grantAchievementsForUser(user.id)
        if (unlocked.length > 0) pushAchievementsToQueue(unlocked)
      }

      if (recent) {
        recentRowRef.current = recent.row
        setRecentOrphan({
          id: recent.row.id,
          workoutDayId: recent.row.workout_day_id,
          workoutLabelSnapshot: recent.row.workout_label_snapshot,
          startedAt: recent.row.started_at,
          cycleId: recent.row.cycle_id,
          lastSetAt: recent.lastSetAt,
        })
        trackSessionEvent("session_orphan_prompted", { surface: "app_open" })
      }
    })()
  }, [user, data, session, queryClient])

  const dismiss = useCallback(() => {
    recentRowRef.current = null
    setRecentOrphan(null)
  }, [])

  // Reopen the orphan locally: seed its `sessionMeta` so new set logs upsert on
  // the same row, activate the atom, then clear the prompt.
  const resume = useCallback(() => {
    const row = recentRowRef.current
    const userId = user?.id
    if (!row || !userId) return

    resumeOrphanSession(
      {
        id: row.id,
        workout_day_id: row.workout_day_id,
        workout_label_snapshot: row.workout_label_snapshot ?? "",
        started_at: row.started_at,
        cycle_id: row.cycle_id,
      },
      userId,
    )
    trackSessionEvent("session_orphan_resumed", { surface: "app_open" })

    recentRowRef.current = null
    setRecentOrphan(null)
  }, [user])

  const finish = useCallback(async () => {
    const row = recentRowRef.current
    if (!row) return

    // An explicit Finish has no idle threshold: force the last-set payload even
    // though a recent orphan is inside `ORPHAN_SESSION_THRESHOLD_MS`.
    const close = computeOrphanClose(
      row.set_logs ?? [],
      Number.POSITIVE_INFINITY,
    )
    if (!close) return

    const { error } = await closeOpenSession(row.id, close)

    // A failed close leaves the row open; clearing the prompt would present it
    // as success and lose the user's only feedback. Keep it up.
    if (error) return

    trackSessionEvent("session_orphan_closed", {
      cause: "open_prompt",
      session_id: row.id,
      total_sets_done: close.totalSetsDone,
    })
    invalidateClosedQueries(queryClient)

    if (user?.id) {
      const unlocked = await grantAchievementsForUser(user.id)
      if (unlocked.length > 0) pushAchievementsToQueue(unlocked)
    }

    recentRowRef.current = null
    setRecentOrphan(null)
  }, [queryClient, user])

  return { recentOrphan, dismiss, resume, finish }
}
