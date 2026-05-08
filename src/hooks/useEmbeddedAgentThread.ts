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

export type DraftTrigger = "ready_signal" | "turn_cap" | "user_cta"

export interface DraftPreviewArgs {
  name: string
  days: Array<{ label: string; exercises: string[] }>
}

export interface DraftPreview {
  args: DraftPreviewArgs
  rendered?: string
}

export interface GenerateDraftResponse {
  status: "preview_ready"
  preview: DraftPreview
  trigger: DraftTrigger
}

export type EmbeddedAgentError =
  // The chat surface needs to distinguish between hourly turn quota
  // (`useSendMessage`), the daily draft quota and the cross-source
  // program quota (both `useGenerateDraft`). `which` lets the UI pick
  // the right copy without re-decoding the wire error.
  | { kind: "quota"; which?: "turn" | "draft" | "program"; limit?: number; used?: number }
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

  if (code === "turn_quota_exceeded") {
    return {
      kind: "quota",
      which: "turn",
      limit: typeof body?.limit === "number" ? body.limit : 40,
      used: typeof body?.used === "number" ? body.used : 40,
    }
  }
  if (code === "draft_quota_exceeded") {
    return {
      kind: "quota",
      which: "draft",
      limit: typeof body?.limit === "number" ? body.limit : 3,
      used: typeof body?.used === "number" ? body.used : 3,
    }
  }
  if (code === "program_quota_exceeded") {
    return { kind: "quota", which: "program" }
  }
  // Generic 429 fallback (no specific code).
  if (status === 429) return { kind: "quota" }

  if (status === 409 || code === "no_active_thread") return { kind: "no_active_thread" }
  if (
    status === 502 ||
    code === "model_failure" ||
    code === "draft_failed" ||
    code === "mcp_failed"
  ) {
    return { kind: "model_failure" }
  }
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

/**
 * Fires the program draft step (`/draft`). On success the server has
 * persisted `last_preview` and flipped the thread to `preview_ready`;
 * we invalidate the thread cache so consumers re-fetch the new status
 * and pick up the preview payload. Errors are typed via
 * `EmbeddedAgentError` so the UI can branch on quota.which (turn /
 * draft / program) and model_failure independently.
 */
export function useGenerateDraft() {
  const queryClient = useQueryClient()
  return useMutation<
    GenerateDraftResponse,
    EmbeddedAgentError,
    { trigger: DraftTrigger; locale: "en" | "fr" }
  >({
    mutationFn: ({ trigger, locale }) =>
      callEmbeddedAgent<GenerateDraftResponse>({ action: "draft", trigger, locale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: THREAD_QUERY_KEY })
    },
  })
}
