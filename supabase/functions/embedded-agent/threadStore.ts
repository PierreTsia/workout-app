// Thread persistence helpers for the Embedded Agent onboarding flow (Phase B
// of epic #295). The shape mirrors the `embedded_agent_threads` migration:
// raw transcript while active, deterministic summary on commit, lazy 7d
// staleness, lazy 90d body purge.

const STALENESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const RETENTION_WINDOW_MS = 90 * 24 * 60 * 60 * 1000
const THREADS_TABLE = "embedded_agent_threads"

export type ThreadStatus = "open" | "preview_ready" | "committed" | "abandoned"
export type ThreadRole = "user" | "assistant"
export type ThreadLocale = "en" | "fr"

export interface ThreadMessage {
  role: ThreadRole
  content: string
  ts: string
}

// supabase-js returns timestamptz columns as ISO strings on the wire; we
// keep them as strings here so the runtime shape matches what helpers
// actually receive. Date-aware helpers (`isStale`, `isRetentionDue`) accept
// `string | Date` and parse internally so unit fixtures stay readable.
export type Timestamp = string | Date

export interface Thread {
  id: string
  user_id: string
  status: ThreadStatus
  messages: ThreadMessage[] | null
  last_preview: Record<string, unknown> | null
  locale: ThreadLocale | null
  program_id: string | null
  summary: string | null
  user_turn_count: number
  assistant_turn_count: number
  draft_count_24h: number
  created_at: Timestamp
  updated_at: Timestamp
  committed_at: Timestamp | null
  abandoned_at: Timestamp | null
}

// Minimal Supabase surface used by this module. Tests inject a fake; the real
// `@supabase/supabase-js` client satisfies this implicitly. Keeping the type
// narrow makes refactor-safe tests possible without pulling the full client
// type (and without coupling tests to driver internals).
export interface SupabaseLike {
  from(table: string): SupabaseChain
}
interface SupabaseChain {
  select(columns?: string): SupabaseChain
  insert(values: Record<string, unknown>): SupabaseChain
  update(values: Record<string, unknown>): SupabaseChain
  eq(column: string, value: unknown): SupabaseChain
  in(column: string, values: unknown[]): SupabaseChain
  order(column: string, opts?: { ascending: boolean }): SupabaseChain
  limit(n: number): SupabaseChain
  maybeSingle(): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
  single(): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
  then(resolve: (v: unknown) => void): void
}

const ACTIVE_STATUSES: ThreadStatus[] = ["open", "preview_ready"]
const UNIQUE_VIOLATION_CODE = "23505"

/**
 * Read-only lookup for the user's active onboarding thread. Returns null when
 * the user has no row in {open, preview_ready}. Use this from routes that
 * shouldn't side-effect (e.g. `/thread { abandon }` is a no-op when there's
 * nothing to abandon).
 */
export async function getActiveThread(
  supabase: SupabaseLike,
  userId: string,
): Promise<Thread | null> {
  const { data, error } = await supabase
    .from(THREADS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle()
  if (error) {
    throw new Error(`getActiveThread failed: ${error.message ?? "unknown"}`)
  }
  return (data as Thread | null) ?? null
}

/**
 * Resolve the user's active onboarding thread. If one exists in {open,
 * preview_ready}, return it (`resumed: true`); otherwise insert a fresh
 * `open` row and return it (`resumed: false`). The DB-level partial unique
 * index guarantees at most one active row per user; on a concurrent insert
 * race we surface the existing row rather than throw.
 */
export async function getOrCreateActiveThread(
  supabase: SupabaseLike,
  userId: string,
  locale: ThreadLocale,
): Promise<{ thread: Thread; resumed: boolean }> {
  const existing = await getActiveThread(supabase, userId)
  if (existing) {
    return { thread: existing, resumed: true }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from(THREADS_TABLE)
    .insert({ user_id: userId, status: "open", locale })
    .select("*")
    .single()

  // Multi-tab race: another concurrent caller already inserted an active row.
  // The partial unique index surfaces this as Postgres 23505. Re-select the
  // winning row instead of letting the user see an error.
  if (insertErr?.code === UNIQUE_VIOLATION_CODE) {
    const resumedRow = await getActiveThread(supabase, userId)
    if (!resumedRow) {
      throw new Error("getOrCreateActiveThread race resume returned no row")
    }
    return { thread: resumedRow, resumed: true }
  }

  if (insertErr) {
    throw new Error(`getOrCreateActiveThread insert failed: ${insertErr.message ?? "unknown"}`)
  }
  if (!inserted) {
    throw new Error("getOrCreateActiveThread insert returned no row")
  }
  return { thread: inserted as Thread, resumed: false }
}

function toMs(at: Timestamp): number {
  return typeof at === "string" ? new Date(at).getTime() : at.getTime()
}

export function isStale(updatedAt: Timestamp, nowMs: number): boolean {
  return nowMs - toMs(updatedAt) > STALENESS_WINDOW_MS
}

export function isRetentionDue(at: Timestamp | null, nowMs: number): boolean {
  if (at === null) return false
  return nowMs - toMs(at) > RETENTION_WINDOW_MS
}

/**
 * Lazy 7d staleness sweep. Caller invokes this on every thread touch (e.g.
 * `/thread`, `/message`) so we don't need a Supabase cron. Only `open`
 * threads get auto-abandoned — `preview_ready` already represents user
 * intent and shouldn't expire silently.
 */
export async function markStaleIfDue(
  supabase: SupabaseLike,
  thread: Thread,
  nowMs: number = Date.now(),
): Promise<{ stale: boolean; thread: Thread }> {
  if (thread.status !== "open" || !isStale(thread.updated_at, nowMs)) {
    return { stale: false, thread }
  }
  await setStatus(supabase, thread, "abandoned", {}, new Date(nowMs).toISOString())
  return { stale: true, thread: { ...thread, status: "abandoned" } }
}

/**
 * Lazy 90d retention sweep. Caller invokes on every thread touch. Clears the
 * raw `messages` JSONB once the thread has been in a terminal state long
 * enough; metadata (`status`, `program_id`, `summary`, timestamps) survives.
 * Idempotent — already-purged rows are a no-op.
 */
export async function purgeRetentionIfDue(
  supabase: SupabaseLike,
  thread: Thread,
  nowMs: number = Date.now(),
): Promise<{ purged: boolean }> {
  const terminalAt = thread.committed_at ?? thread.abandoned_at
  if (!isRetentionDue(terminalAt, nowMs) || thread.messages === null) {
    return { purged: false }
  }
  await supabase
    .from(THREADS_TABLE)
    .update({ messages: null, updated_at: new Date(nowMs).toISOString() })
    .eq("id", thread.id)
  return { purged: true }
}

export async function setLastPreview(
  supabase: SupabaseLike,
  thread: Thread,
  payload: Record<string, unknown>,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await supabase
    .from(THREADS_TABLE)
    .update({ last_preview: payload, updated_at: nowIso })
    .eq("id", thread.id)
}

export interface SetStatusPatch {
  program_id?: string
  summary?: string
}

export async function setStatus(
  supabase: SupabaseLike,
  thread: Thread,
  status: ThreadStatus,
  patch: SetStatusPatch = {},
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  const committedExtras = status === "committed"
    ? {
        committed_at: nowIso,
        messages: null,
        ...(patch.program_id !== undefined ? { program_id: patch.program_id } : {}),
        ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      }
    : {}
  const abandonedExtras = status === "abandoned" ? { abandoned_at: nowIso } : {}

  const values = {
    status,
    updated_at: nowIso,
    ...committedExtras,
    ...abandonedExtras,
  }

  await supabase
    .from(THREADS_TABLE)
    .update(values)
    .eq("id", thread.id)
}

/**
 * Increment the per-thread draft counter. Source-of-truth for the
 * 3-drafts-per-24h cap is `ai_generation_log` (see `quota.ts`); this
 * column is a denormalized fast-path for UI hints (e.g. "2 of 3 drafts
 * used today") that don't want to round-trip through the log table.
 */
export async function bumpDraftCount24h(
  supabase: SupabaseLike,
  thread: Thread,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await supabase
    .from(THREADS_TABLE)
    .update({
      draft_count_24h: (thread.draft_count_24h ?? 0) + 1,
      updated_at: nowIso,
    })
    .eq("id", thread.id)
}

export async function appendMessage(
  supabase: SupabaseLike,
  thread: Thread,
  role: ThreadRole,
  content: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  const nextMessages: ThreadMessage[] = [
    ...(thread.messages ?? []),
    { role, content, ts: nowIso },
  ]
  const userBump = role === "user" ? 1 : 0
  const assistantBump = role === "assistant" ? 1 : 0

  await supabase
    .from(THREADS_TABLE)
    .update({
      messages: nextMessages,
      user_turn_count: thread.user_turn_count + userBump,
      assistant_turn_count: thread.assistant_turn_count + assistantBump,
      updated_at: nowIso,
    })
    .eq("id", thread.id)
}
