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

export interface SendMessageResponse {
  assistant: { content: string; ts: string }
  ready_for_draft: boolean
}

export type EmbeddedAgentError =
  | { kind: "quota"; limit: number; used: number }
  | { kind: "no_active_thread" }
  | { kind: "model_failure" }
  | { kind: "unknown"; message: string }

const THREAD_QUERY_KEY = ["embedded-agent", "thread"] as const

interface InvokeError {
  context?: Response
  message?: string
}

async function readErrorBody(error: InvokeError): Promise<Record<string, unknown> | null> {
  try {
    const ctx = error.context
    if (!ctx || typeof ctx.json !== "function") return null
    return await ctx.clone().json() as Record<string, unknown>
  } catch {
    return null
  }
}

async function toEmbeddedAgentError(error: InvokeError): Promise<EmbeddedAgentError> {
  const status = error.context?.status
  const body = await readErrorBody(error)
  const code = typeof body?.error === "string" ? body.error : undefined

  if (status === 429 || code === "turn_quota_exceeded") {
    return {
      kind: "quota",
      limit: typeof body?.limit === "number" ? body.limit : 40,
      used: typeof body?.used === "number" ? body.used : 40,
    }
  }
  if (status === 409 || code === "no_active_thread") return { kind: "no_active_thread" }
  if (status === 502 || code === "model_failure") return { kind: "model_failure" }
  return { kind: "unknown", message: error.message ?? code ?? "Unknown error" }
}

async function callEmbeddedAgent<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("embedded-agent", { body })
  if (error) {
    const typed = await toEmbeddedAgentError(error as InvokeError)
    throw typed
  }
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

/**
 * Sends one user message to `/message`.
 *
 * UX contract:
 *  - `onMutate` optimistically appends the user bubble *before* the network
 *    call so the chat surface reacts on submit (Telegram/WhatsApp feel),
 *    not after Gemini finally answers ~5–15s later.
 *  - This is safe because the server persists the user message *first*
 *    (before the quota check or model call), so even on quota / model
 *    failure the cache stays consistent with the database.
 *  - `onSuccess` then appends the assistant turn.
 *  - On error we keep the user bubble (it's persisted server-side) and let
 *    the UI branch on `EmbeddedAgentError.kind` to show the right banner.
 */
export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation<
    SendMessageResponse,
    EmbeddedAgentError,
    { content: string; locale: "en" | "fr" }
  >({
    mutationFn: ({ content, locale }) =>
      callEmbeddedAgent<SendMessageResponse>({ action: "send", content, locale }),
    onMutate: (variables) => {
      queryClient.setQueryData<ThreadPayload>(THREAD_QUERY_KEY, (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          messages: [
            ...prev.messages,
            { role: "user", content: variables.content, ts: new Date().toISOString() },
          ],
        }
      })
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ThreadPayload>(THREAD_QUERY_KEY, (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          messages: [
            ...prev.messages,
            { role: "assistant", content: data.assistant.content, ts: data.assistant.ts },
          ],
        }
      })
    },
  })
}
