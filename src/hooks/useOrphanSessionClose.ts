import { useEffect, useRef } from "react"
import { useAtomValue } from "jotai"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { authAtom, sessionAtom } from "@/store/atoms"
import { computeOrphanClose } from "@/lib/orphanSessionClose"
import {
  peekSessionRealId,
  pruneCancelledSessions,
  queuedRealSessionIds,
} from "@/lib/syncService"

interface OpenSessionRow {
  id: string
  set_logs: { logged_at: string }[] | null
}

/**
 * Self-heals orphan sessions at app open (#568).
 *
 * A session whose `finished_at` never landed (user closed the tab before
 * tapping "Terminer") keeps its `set_logs` but stays open — and invisible in
 * History. This hook reads the user's open sessions and closes any whose last
 * set is older than the threshold, writing the last set as `finished_at`
 * (never `now()`).
 *
 * Guards (never close something still alive):
 * - the active local session (via `peekSessionRealId`);
 * - any session still present in the offline queue — a queued
 *   `session_finish` would drain later and overwrite our `finished_at`.
 *
 * The UPDATE carries `.is("finished_at", null)`, so it is idempotent and can
 * never touch an already-closed session. Fires at most once per mount.
 */
export function useOrphanSessionClose(): void {
  const user = useAtomValue(authAtom)
  const session = useAtomValue(sessionAtom)
  const queryClient = useQueryClient()
  const triggeredRef = useRef(false)

  const { data } = useQuery<OpenSessionRow[]>({
    queryKey: ["orphan-open-sessions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, set_logs(logged_at)")
        .is("finished_at", null)
        .returns<OpenSessionRow[]>()

      if (error) throw error
      return data ?? []
    },
  })

  useEffect(() => {
    if (triggeredRef.current) return
    if (!user || !data) return
    triggeredRef.current = true

    const excluded = queuedRealSessionIds()
    // A session cancelled while offline keeps its row (the best-effort delete
    // failed); the deny-list is the only marker. Without this, a cancelled
    // session would come back as "unfinished" and be closed into a real workout.
    for (const id of pruneCancelledSessions(user.id)) excluded.add(id)
    if (session.isActive && session.startedAt != null) {
      const activeId = peekSessionRealId(user.id, `local-${session.startedAt}`)
      if (activeId) excluded.add(activeId)
    }

    const now = Date.now()
    void (async () => {
      let closed = 0
      for (const row of data) {
        if (excluded.has(row.id)) continue
        const close = computeOrphanClose(row.set_logs ?? [], now)
        if (!close) continue

        const { error } = await supabase
          .from("sessions")
          .update({
            finished_at: close.finishedAt,
            total_sets_done: close.totalSetsDone,
            active_duration_ms: close.activeDurationMs,
            has_skipped_sets: false,
          })
          .eq("id", row.id)
          .is("finished_at", null)

        if (!error) closed += 1
      }

      if (closed > 0) {
        queryClient.invalidateQueries({ queryKey: ["sessions"] })
        queryClient.invalidateQueries({ queryKey: ["sessions-date-range"] })
        queryClient.invalidateQueries({ queryKey: ["training-activity-by-day"] })
        queryClient.invalidateQueries({ queryKey: ["last-session-for-day"] })
        queryClient.invalidateQueries({ queryKey: ["cycle-sessions"] })
      }
    })()
  }, [user, data, session, queryClient])
}
