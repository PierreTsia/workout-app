import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useStore } from "jotai"
import { supabase } from "@/lib/supabase"
import { activeProgramIdAtom, hasProgramAtom } from "@/store/atoms"

// T131 (#343) — mirrors `ThreadPurpose` on the Edge function. Single source
// of truth for the wire contract lives in
// `supabase/functions/embedded-agent/threadStore.ts`; duplicated here so
// frontend code doesn't reach across the supabase/ boundary at type level.
export type ThreadPurpose = "onboarding" | "additional_program"

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
  // Mirrors `embedded_agent_threads.last_preview`. Non-null only when
  // status === 'preview_ready'; the EmbeddedAgentPreviewStep renders
  // straight from this without a second fetch.
  last_preview: DraftPreview | null
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

/**
 * One day's worth of preview echo lines, ready to render in the preview UI
 * without further parsing. Mirrors `RenderedDay` from
 * `supabase/functions/embedded-agent/draft.ts`. Optional on `DraftPreview`
 * because the size guard drops it past 32 KB and the client falls back to
 * rendering from `args` directly.
 */
export interface RenderedDay {
  label: string
  lines: string[]
}

export interface DraftPreview {
  args: DraftPreviewArgs
  rendered?: RenderedDay[]
}

export interface GenerateDraftResponse {
  status: "preview_ready"
  preview: DraftPreview
  trigger: DraftTrigger
}

export interface CommitPreviewResponse {
  program_id: string
}

export type EmbeddedAgentError =
  // The chat surface needs to distinguish between hourly turn quota
  // (`useSendMessage`), the daily draft quota and the cross-source
  // program quota (both `useGenerateDraft`). `which` lets the UI pick
  // the right copy without re-decoding the wire error.
  | { kind: "quota"; which?: "turn" | "draft" | "program"; limit?: number; used?: number }
  | { kind: "no_active_thread" }
  | { kind: "model_failure" }
  | { kind: "commit_failed"; mcp_kind?: string }
  | { kind: "unknown"; message: string }

// T131 (#343) — cache key includes `purpose` so onboarding and
// additional_program threads have independent React Query entries; mutations
// invalidate only their own purpose.
const threadQueryKey = (purpose: ThreadPurpose) =>
  ["embedded-agent", "thread", purpose] as const

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

  // /commit failure modes. Server-trusted gate returned 502 — the client
  // surfaces this as a distinct kind so the preview UI can render a retry
  // button without dumping the user back to chat (the preview is still in
  // last_preview server-side, status stays at preview_ready).
  if (code === "commit_failed") {
    const mcpKind = typeof body?.kind === "string" ? body.kind : undefined
    return { kind: "commit_failed", mcp_kind: mcpKind }
  }

  // Three 409 codes from /commit (no_active_thread, not_preview_ready,
  // no_preview) all indicate "your client state has drifted from the
  // server" — collapse to a single `no_active_thread` kind so the consumer
  // UI doesn't need to switch on near-identical conditions.
  if (
    status === 409 ||
    code === "no_active_thread" ||
    code === "not_preview_ready" ||
    code === "no_preview"
  ) {
    return { kind: "no_active_thread" }
  }
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
 * Resumes-or-creates the user's active thread for `purpose` by hitting the
 * `/thread { action: "open" }` Edge route. Single-flight per purpose via
 * the `embedded-agent/thread/<purpose>` cache key so onboarding and
 * additional-program flows have isolated caches.
 */
export function useThread(purpose: ThreadPurpose, locale: "en" | "fr") {
  return useQuery<ThreadPayload>({
    queryKey: threadQueryKey(purpose),
    queryFn: () =>
      callEmbeddedAgent<ThreadPayload>({ action: "open", purpose, locale }),
  })
}

/**
 * Abandons the user's active thread for `purpose`, then invalidates the
 * matching thread cache so the next mount creates a fresh row. Idempotent
 * on the server. Other purposes' caches are untouched.
 */
export function useAbandonThread(purpose: ThreadPurpose) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      callEmbeddedAgent<{ ok: true }>({ action: "abandon", purpose }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadQueryKey(purpose) })
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
export function useSendMessage(purpose: ThreadPurpose) {
  const queryClient = useQueryClient()
  const queryKey = threadQueryKey(purpose)
  return useMutation<
    SendMessageResponse,
    EmbeddedAgentError,
    { content: string; locale: "en" | "fr" }
  >({
    mutationFn: ({ content, locale }) =>
      callEmbeddedAgent<SendMessageResponse>({
        action: "send",
        purpose,
        content,
        locale,
      }),
    onMutate: (variables) => {
      queryClient.setQueryData<ThreadPayload>(queryKey, (prev) => {
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
      queryClient.setQueryData<ThreadPayload>(queryKey, (prev) => {
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
export function useGenerateDraft(purpose: ThreadPurpose) {
  const queryClient = useQueryClient()
  return useMutation<
    GenerateDraftResponse,
    EmbeddedAgentError,
    { trigger: DraftTrigger; locale: "en" | "fr" }
  >({
    mutationFn: ({ trigger, locale }) =>
      callEmbeddedAgent<GenerateDraftResponse>({
        action: "draft",
        purpose,
        trigger,
        locale,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadQueryKey(purpose) })
    },
  })
}

/**
 * Reject the stashed preview (`/reject`). Server flips the thread back to
 * `open` and clears `last_preview`; we invalidate the thread cache so the
 * consumer re-fetches the now-open thread and the preview screen
 * unmounts. Idempotent server-side, so the UI can fire this on every
 * "Regenerate" click without guarding.
 */
export function useRejectPreview(purpose: ThreadPurpose) {
  const queryClient = useQueryClient()
  return useMutation<{ ok: true; status: "open" }, EmbeddedAgentError, void>({
    mutationFn: () =>
      callEmbeddedAgent<{ ok: true; status: "open" }>({ action: "reject", purpose }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadQueryKey(purpose) })
    },
  })
}

/**
 * Close the commit gate (`/commit`). Always sends `confirm: true`; the UI
 * never has to think about the gate (the gate is enforced server-side as
 * defense in depth, not because we trust the wire). On success the thread
 * flips to `committed` and we invalidate the cache so consumers see the
 * terminal state. Errors:
 *   - `commit_failed` (502): MCP transport / rpc / invalid response. The
 *     server kept status at `preview_ready` so the user can retry without
 *     re-drafting; the UI surfaces this with a retry button on the preview.
 *   - `no_active_thread` (409): client state drifted (no thread, status
 *     not preview_ready, or last_preview gone) — UI bails to chat.
 */
export function useCommitPreview(purpose: ThreadPurpose) {
  const queryClient = useQueryClient()
  // Grab the ambient store via the hook so we work with whatever JotaiProvider
  // wraps the tree (production: default global store; tests: per-test store).
  // Using `getDefaultStore()` directly would skip provider isolation and break
  // test parallelism.
  const store = useStore()
  return useMutation<CommitPreviewResponse, EmbeddedAgentError, void>({
    mutationFn: () =>
      callEmbeddedAgent<CommitPreviewResponse>({
        action: "commit",
        purpose,
        confirm: true,
      }),
    onSuccess: (data) => {
      // Mirror the legacy AIProgramPreviewStep post-create sync so the home
      // shell sees the new active program immediately on navigation. Without
      // this, the user lands on "/" with `hasProgramAtom === false` and gets
      // bounced back into onboarding (or sees an empty home).
      store.set(hasProgramAtom, true)
      store.set(activeProgramIdAtom, data.program_id)
      queryClient.invalidateQueries({ queryKey: threadQueryKey(purpose) })
      queryClient.invalidateQueries({ queryKey: ["workout-days"] })
      queryClient.invalidateQueries({ queryKey: ["active-program"] })
      queryClient.invalidateQueries({ queryKey: ["user-programs"] })
    },
  })
}
