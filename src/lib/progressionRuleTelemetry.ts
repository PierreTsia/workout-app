import { getDefaultStore } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { ProgressionRule } from "@/lib/progression"

/**
 * One served **Progression Rule**, as the athlete actually saw it in-session
 * (T706, epic #705). The measurement prerequisite for the plateau work: the rule
 * enum is never persisted anywhere else, so this event is the only record.
 */
export type ProgressionRuleServedEvent = {
  rule: ProgressionRule
  volumeType: "reps" | "duration"
  workoutExerciseId: string
  exerciseId: string
  sessionId: string
}

export const PROGRESSION_RULE_SERVED = "progression_rule_served"

/**
 * Fire-and-forget insert of one served rule into `analytics_events`.
 *
 * The explicit `then` is load-bearing: a supabase-js builder only sends its
 * request from `then()`, so `void builder` never fires (unlike the pattern in
 * `sessionEvents.ts`). No-op without a user; an insert failure is swallowed —
 * telemetry must never reach the UI or the progression path.
 */
export function trackProgressionRuleServed(
  event: ProgressionRuleServedEvent,
): void {
  const user = getDefaultStore().get(authAtom)
  if (!user) return

  supabase
    .from("analytics_events")
    .insert({
      event_type: PROGRESSION_RULE_SERVED,
      user_id: user.id,
      payload: event,
    })
    .then(
      () => {},
      () => {},
    )
}
