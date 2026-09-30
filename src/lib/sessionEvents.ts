import { getDefaultStore } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

/**
 * Orphan-session instrumentation (#571). Mirrors `useTrackEvent` but callable
 * outside React — the boot hook and the start guard both need it.
 */
export type SessionEventType =
  | "session_orphan_closed"
  | "session_orphan_prompted"
  | "session_orphan_resumed"
  | "session_start_blocked"

/** Fire-and-forget insert into `analytics_events`. No-op without a user. */
export function trackSessionEvent(
  eventType: SessionEventType,
  payload: Record<string, unknown> = {},
): void {
  const user = getDefaultStore().get(authAtom)
  if (!user) return

  void supabase.from("analytics_events").insert({
    event_type: eventType,
    user_id: user.id,
    payload,
  })
}
