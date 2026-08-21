import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"

function parseStartedAt(data: unknown): string | null {
  if (typeof data !== "object" || data == null || Array.isArray(data)) return null
  if (!("started_at" in data)) return null
  const started = data.started_at
  return typeof started === "string" ? started : null
}

/** Scalar MIN(sessions.started_at) for finished sessions — not a session-list dump. */
export function useFirstFinishedSessionAt() {
  const user = useAtomValue(authAtom)
  return useQuery({
    queryKey: ["first-finished-session", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("started_at")
        .eq("user_id", user!.id)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return parseStartedAt(data)
    },
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  })
}
