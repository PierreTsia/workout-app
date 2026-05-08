import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export interface ThreadMessage {
  role: "user" | "assistant"
  content: string
  ts: string
}

export interface ThreadPayload {
  thread_id: string
  status: "open" | "preview_ready" | "committed" | "abandoned"
  resumed: boolean
  messages: ThreadMessage[]
}

const THREAD_QUERY_KEY = ["embedded-agent", "thread"] as const

async function callEmbeddedAgent<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("embedded-agent", { body })
  if (error) throw error
  if (!data) throw new Error("Empty response from embedded-agent")
  return data as T
}

/**
 * Resumes-or-creates the user's active onboarding thread by hitting the
 * `/thread { action: "open" }` Edge route. Single-flight via the
 * `embedded-agent/thread` cache key so any consumer shares the same row.
 */
export function useThread(locale: "en" | "fr") {
  return useQuery<ThreadPayload>({
    queryKey: THREAD_QUERY_KEY,
    queryFn: () => callEmbeddedAgent<ThreadPayload>({ action: "open", locale }),
  })
}

/**
 * Abandons the active thread, then invalidates the thread cache so the next
 * mount of `useThread` creates a fresh row. Idempotent on the server.
 */
export function useAbandonThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => callEmbeddedAgent<{ ok: true }>({ action: "abandon" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: THREAD_QUERY_KEY })
    },
  })
}
