import { useMutation } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

interface TrackEventInput {
  eventType: string
  payload?: Record<string, unknown>
}

export function useTrackEvent() {
  const user = useAtomValue(authAtom)

  return useMutation({
    mutationFn: async ({ eventType, payload }: TrackEventInput) => {
      if (!user) return
      await supabase.from("analytics_events").insert({
        event_type: eventType,
        user_id: user.id,
        payload: payload ?? {},
      })
    },
  })
}
