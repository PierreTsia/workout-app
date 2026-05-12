// Thread persistence helpers for the Embedded Agent onboarding flow (Phase B
// of epic #295). The shape mirrors the `embedded_agent_threads` migration:
// raw transcript while active, deterministic summary on commit, lazy 7d
// staleness, lazy 90d body purge.

import type { UserContextProfile } from "./prompt/index.ts"

const STALENESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const RETENTION_WINDOW_MS = 90 * 24 * 60 * 60 * 1000
const THREADS_TABLE = "embedded_agent_threads"

export type ThreadStatus = "open" | "preview_ready" | "committed" | "abandoned"
export type ThreadRole = "user" | "assistant"
export type ThreadLocale = "en" | "fr"
export type ThreadPurpose = "onboarding" | "additional_program"

// Controlled vocabulary captured by the additional-program motivation gate.
// Enforced in the DB via the `change_motivation` CHECK constraint; mirrored
// here so analytics + UI can switch on a closed set without re-parsing.
export type ChangeMotivation =
  | "variety"
  | "plateau"
  | "injury"
  | "priority_shift"
  | "equipment_change"
  | "return_from_break"
  | "other"

// Validated subset of the ready-signal payload that survives /send and is
// consumed by /draft. Keys are intentionally optional — the validator only
// emits this column when at least one constraint changed vs the profile.
export interface PendingConstraintOverrides {
  daysPerWeek?: number
  duration?: number
  equipmentCategory?: string
  goal?: string
  experience?: string
  focusAreas?: string
  splitPreference?: string
}

// Pre-loaded user context snapshotted at /open for the additional-program
// flow. Shape is intentionally opaque at the type level (Record<string,unknown>)
// — the bundle builder owns its schema; threadStore just persists/reads.
export type BundleContext = Record<string, unknown>

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
  // T131 (#343) — multi-purpose extension. See migration
  // 20260512120000_embedded_agent_threads_multi_purpose.sql.
  purpose: ThreadPurpose
  change_motivation: ChangeMotivation | null
  bundle_context: BundleContext | null
  validator_rejection_count: number
  pending_constraint_overrides: PendingConstraintOverrides | null
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
  // T122: lazy retention purge needs a `<` filter on abandoned_at.
  // Mirrors PostgREST's `.lt()` operator.
  lt(column: string, value: unknown): SupabaseChain
  order(column: string, opts?: { ascending: boolean }): SupabaseChain
  limit(n: number): SupabaseChain
  maybeSingle(): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
  single(): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
  // Bare `await` on an update/insert chain (no .single()) resolves to a
  // PostgREST response shape — typed here so callers can destructure
  // `{ error }` and surface RLS denials / network blips instead of
  // treating them as success (T122 PR review #1).
  then(
    resolve: (v: { data: unknown; error: { code?: string; message?: string } | null }) => void,
  ): void
}

const ACTIVE_STATUSES: ThreadStatus[] = ["open", "preview_ready"]
const UNIQUE_VIOLATION_CODE = "23505"

/**
 * Read-only lookup for the user's active thread on a given purpose. Returns
 * null when there is no row in {open, preview_ready} for that (user_id,
 * purpose) pair. Use this from routes that shouldn't side-effect (e.g.
 * `/abandon` is a no-op when there's nothing to abandon).
 *
 * Keyed on `(user_id, purpose)` since T131 (#343) — a user can hold one
 * active onboarding thread AND one active additional_program thread
 * simultaneously; this lookup scopes by purpose so the two flows don't
 * leak into each other.
 */
export async function getActiveThread(
  supabase: SupabaseLike,
  userId: string,
  purpose: ThreadPurpose,
): Promise<Thread | null> {
  const { data, error } = await supabase
    .from(THREADS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle()
  if (error) {
    throw new Error(`getActiveThread failed: ${error.message ?? "unknown"}`)
  }
  return (data as Thread | null) ?? null
}

/**
 * Resolve the user's active thread for a given purpose. If one exists in
 * {open, preview_ready}, return it (`resumed: true`); otherwise insert a
 * fresh `open` row tagged with that purpose and return it (`resumed: false`).
 * The DB-level partial unique index `(user_id, purpose) WHERE status IN
 * ('open','preview_ready')` guarantees at most one active row per
 * (user, purpose); on a concurrent insert race we surface the existing row
 * rather than throw.
 */
export async function getOrCreateActiveThread(
  supabase: SupabaseLike,
  userId: string,
  locale: ThreadLocale,
  purpose: ThreadPurpose,
): Promise<{ thread: Thread; resumed: boolean }> {
  const existing = await getActiveThread(supabase, userId, purpose)
  if (existing) {
    return { thread: existing, resumed: true }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from(THREADS_TABLE)
    .insert({ user_id: userId, status: "open", locale, purpose })
    .select("*")
    .single()

  // Multi-tab race: another concurrent caller already inserted an active row
  // for this (user_id, purpose). The partial unique index surfaces this as
  // Postgres 23505. Re-select the winning row instead of letting the user
  // see an error.
  if (insertErr?.code === UNIQUE_VIOLATION_CODE) {
    const resumedRow = await getActiveThread(supabase, userId, purpose)
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
  // PostgREST doesn't throw on RLS denial / network blips — it returns
  // `{ error }` on the resolved promise. Silently treating that as
  // success would leave a 90+ day-old transcript on disk in violation
  // of the retention policy, so we surface the failure as a thrown
  // Error and let the route layer catch it.
  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({ messages: null, updated_at: new Date(nowMs).toISOString() })
    .eq("id", thread.id)
  if (error) {
    throw new Error(`purgeRetentionIfDue failed: ${error.message ?? "unknown"}`)
  }
  return { purged: true }
}

/**
 * Per-user 90d retention sweep (T122). Called from the handler at the
 * top of every authenticated request to fulfill the T121 "raw text is
 * purged after 90 days" promise without a Supabase cron.
 *
 * Targets `abandoned` threads only — `committed` threads have their
 * `messages` cleared inline at commit time (see `setStatus("committed")`)
 * so the 90d window for committed threads is effectively 0d. Abandoned
 * threads keep their transcript until this sweep clears it (in case the
 * user wants to come back, though we don't expose that path today).
 *
 * Single conditional UPDATE — no per-row fetch — gated by user_id so
 * the sweep cost is O(this user's terminal rows) per request, not O(all
 * terminal rows in the table). Idempotent: `messages: null` on already
 * purged rows is a no-op.
 */
export async function purgeDueForUser(
  supabase: SupabaseLike,
  userId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  const cutoffIso = new Date(nowMs - RETENTION_WINDOW_MS).toISOString()
  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({ messages: null, updated_at: new Date(nowMs).toISOString() })
    .eq("user_id", userId)
    .eq("status", "abandoned")
    .lt("abandoned_at", cutoffIso)
  if (error) {
    throw new Error(`purgeDueForUser failed: ${error.message ?? "unknown"}`)
  }
}

export async function setLastPreview(
  supabase: SupabaseLike,
  thread: Thread,
  payload: Record<string, unknown>,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({ last_preview: payload, updated_at: nowIso })
    .eq("id", thread.id)
  if (error) {
    throw new Error(`setLastPreview failed: ${error.message ?? "unknown"}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional-program flow helpers (T131, #343)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist the snapshotted user context (profile + active program summary +
 * 4-week training stats) into `bundle_context`. Written once at /open for
 * additional_program threads. Bound to ~8 KB by the bundle builder.
 */
export async function setBundle(
  supabase: SupabaseLike,
  thread: Thread,
  bundle: BundleContext,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({ bundle_context: bundle, updated_at: nowIso })
    .eq("id", thread.id)
  if (error) {
    throw new Error(`setBundle failed: ${error.message ?? "unknown"}`)
  }
}

/**
 * Bump `validator_rejection_count` by 1. Used by /send when the ready-signal
 * validator rejects (missing motivation, `invalid_override`, etc.) so the
 * agent's prompt can include the bounded retry counter and give up gracefully
 * after the cap.
 */
export async function incrementValidatorRejection(
  supabase: SupabaseLike,
  thread: Thread,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({
      validator_rejection_count: (thread.validator_rejection_count ?? 0) + 1,
      updated_at: nowIso,
    })
    .eq("id", thread.id)
  if (error) {
    throw new Error(`incrementValidatorRejection failed: ${error.message ?? "unknown"}`)
  }
}

/**
 * Persist the validated change motivation classification. First-accept-only
 * policy lives at the call site (validator checks `thread.change_motivation
 * === null` before invoking this); the helper itself is an unconditional
 * UPDATE so a retried server-side rewrite is idempotent.
 */
export async function setChangeMotivation(
  supabase: SupabaseLike,
  thread: Thread,
  motivation: ChangeMotivation,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({ change_motivation: motivation, updated_at: nowIso })
    .eq("id", thread.id)
  if (error) {
    throw new Error(`setChangeMotivation failed: ${error.message ?? "unknown"}`)
  }
}

/**
 * Stash validated constraint_overrides from a ready-signal payload so /draft
 * can read them race-free without re-parsing the transcript. /send writes
 * the overrides on accept; /draft calls `consumePendingOverrides` to clear
 * the slot once it has used them.
 *
 * Pass `null` to clear without consuming through the normal path (e.g. when
 * a follow-up /send supersedes a stashed signal).
 */
export async function setPendingConstraintOverrides(
  supabase: SupabaseLike,
  thread: Thread,
  overrides: PendingConstraintOverrides | null,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({ pending_constraint_overrides: overrides, updated_at: nowIso })
    .eq("id", thread.id)
  if (error) {
    throw new Error(`setPendingConstraintOverrides failed: ${error.message ?? "unknown"}`)
  }
}

/**
 * Clear `pending_constraint_overrides` after /draft has merged them into the
 * effective constraints. Idempotent: a no-op when the slot is already NULL.
 */
export async function consumePendingOverrides(
  supabase: SupabaseLike,
  thread: Thread,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await setPendingConstraintOverrides(supabase, thread, null, nowIso)
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

  const { error } = await supabase
    .from(THREADS_TABLE)
    .update(values)
    .eq("id", thread.id)
  if (error) {
    throw new Error(`setStatus(${status}) failed: ${error.message ?? "unknown"}`)
  }
}

/**
 * Atomically transition a `preview_ready` thread back to `open` and drop the
 * stashed preview. Used by `/reject` when the user wants to keep iterating
 * in chat after seeing a draft they don't love. Single update statement is
 * intentional: split into two queries the route would race on hot reload
 * (preview cleared, status still `preview_ready` → client lands on a blank
 * preview screen). The route layer guards against pointless writes when the
 * thread is already in `open` — this helper assumes preview_ready input.
 */
export async function resetForReject(
  supabase: SupabaseLike,
  thread: Thread,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({
      status: "open",
      last_preview: null,
      updated_at: nowIso,
    })
    .eq("id", thread.id)
  if (error) {
    throw new Error(`resetForReject failed: ${error.message ?? "unknown"}`)
  }
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
  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({
      draft_count_24h: (thread.draft_count_24h ?? 0) + 1,
      updated_at: nowIso,
    })
    .eq("id", thread.id)
  if (error) {
    throw new Error(`bumpDraftCount24h failed: ${error.message ?? "unknown"}`)
  }
}

// ---------- buildDeterministicSummary ----------
//
// Pure composer for the long-tail audit string written into
// `embedded_agent_threads.summary` on commit. Stays pure (no model call, no
// I/O) so it survives the 90d transcript purge from T116 — the row keeps a
// human-readable trace of "how did this program get created" even after we
// drop `messages`. Locale-aware so users see their own language; falls back
// to raw values for unknown goal/equipment instead of crashing /commit.

const GOAL_LABELS: Record<ThreadLocale, Record<string, string>> = {
  en: {
    strength: "Strength",
    hypertrophy: "Hypertrophy",
    endurance: "Endurance",
    general_fitness: "General fitness",
  },
  fr: {
    strength: "Force",
    hypertrophy: "Hypertrophie",
    endurance: "Endurance",
    general_fitness: "Forme générale",
  },
}

const EQUIPMENT_LABELS: Record<ThreadLocale, Record<string, string>> = {
  en: {
    gym: "gym",
    home: "home",
    minimal: "minimal",
  },
  fr: {
    gym: "salle complète",
    home: "maison",
    minimal: "matériel minimal",
  },
}

const SUMMARY_TEMPLATES = {
  en: {
    headline: "AI onboarding program created.",
    goal: (g: string) => `Goal: ${g}`,
    cadence: (n: number) => `${n} d/wk`,
    duration: (m: number) => `${m} min`,
    signals: (s: string) => `Notable input from chat: ${s}.`,
    program: (d: number, e: number) => `Program: ${d} days, ${e} exercises.`,
  },
  fr: {
    headline: "Programme créé via l'agent IA.",
    goal: (g: string) => `Objectif : ${g}`,
    cadence: (n: number) => `${n} j/sem`,
    duration: (m: number) => `${m} min`,
    signals: (s: string) => `Apport notable du chat : ${s}.`,
    program: (d: number, e: number) => `Programme : ${d} jours, ${e} exercices.`,
  },
} as const

export interface DeterministicSummaryInput {
  locale: ThreadLocale
  profile: UserContextProfile
  programDays: number
  programExerciseCount: number
  signals?: string[]
}

export function buildDeterministicSummary(input: DeterministicSummaryInput): string {
  const t = SUMMARY_TEMPLATES[input.locale]
  const goalLabel = GOAL_LABELS[input.locale][input.profile.goal] ?? input.profile.goal
  const equipmentLabel = EQUIPMENT_LABELS[input.locale][input.profile.equipment] ??
    input.profile.equipment

  const profileLine = [
    t.goal(goalLabel),
    t.cadence(input.profile.training_days_per_week),
    t.duration(input.profile.session_duration_minutes),
    equipmentLabel,
  ].join(" · ")

  const signalsSentence = input.signals && input.signals.length > 0
    ? ` ${t.signals(input.signals.join(", "))}`
    : ""

  const programSentence = t.program(input.programDays, input.programExerciseCount)

  return `${t.headline} ${profileLine}.${signalsSentence} ${programSentence}`
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

  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({
      messages: nextMessages,
      user_turn_count: thread.user_turn_count + userBump,
      assistant_turn_count: thread.assistant_turn_count + assistantBump,
      updated_at: nowIso,
    })
    .eq("id", thread.id)
  if (error) {
    throw new Error(`appendMessage(${role}) failed: ${error.message ?? "unknown"}`)
  }
}
