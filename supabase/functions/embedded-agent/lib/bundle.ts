// Bundle builder for the additional-program flow (T133, #343). Captures
// the user's training context ONCE at thread open and snapshots it into
// `embedded_agent_threads.bundle_context` so the system prompt can be
// composed from immutable JSON instead of round-tripping every turn.
//
// Single-caller v1 (handler `/open` → `buildAdditionalProgramBundle`) —
// kept under `lib/` instead of `_shared/` until rule-of-three calls for
// promotion. The DI shape (`BuildBundleDeps`) makes the DB reads
// substitutable so unit tests stay decoupled from Supabase.
//
// Hard-coded constraints locked by Tech Plan:
//   - `v: 1` for forward-compat tagging.
//   - 28-day window for `recent_stats`.
//   - 8 KB JSON ceiling (Tech Plan §"Bundle composition / size guard").
//     Hitting this is a builder bug, not a user-facing failure mode —
//     handler maps it to 500.

export const BUNDLE_VERSION = 1
export const BUNDLE_MAX_BYTES = 8192
export const BUNDLE_WINDOW_DAYS = 28
const TOP_MUSCLE_GROUPS_LIMIT = 5
const DAY_MUSCLE_GROUPS_LIMIT = 5

// --- Wire shape (persisted as `embedded_agent_threads.bundle_context`) ---

export interface BundleProfile {
  goal: string
  experience: string
  equipment: string
  training_days_per_week: number
  session_duration_minutes: number
  age: number | null
  weight_kg: number | null
  gender: string | null
}

export interface BundleProgramDay {
  label: string
  exercise_count: number
  // Unique, sorted (ascending), capped at DAY_MUSCLE_GROUPS_LIMIT entries.
  // Prompt rendering relies on stable ordering so two opens of the same
  // active program produce byte-identical bundles.
  muscle_groups: string[]
}

export interface BundleActiveProgram {
  id: string
  name: string
  days: BundleProgramDay[]
}

export interface BundleRecentStats {
  window_days: typeof BUNDLE_WINDOW_DAYS
  total_sessions: number
  sessions_per_week: number
  // Top N by set count, descending. Tie-breaking is by lexical order so
  // the snapshot stays deterministic across two reads on the same data.
  top_muscle_groups: string[]
  avg_session_duration_minutes: number | null
}

export interface AdditionalProgramBundle {
  v: typeof BUNDLE_VERSION
  captured_at: string
  profile: BundleProfile
  active_program: BundleActiveProgram | null
  recent_stats: BundleRecentStats
}

// --- DI shape ---

// Mirrors `user_profiles` columns we need; `null` allowed on the optional
// ones so the row type matches the actual schema.
export interface ProfileRow {
  goal: string
  experience: string
  equipment: string
  training_days_per_week: number
  session_duration_minutes: number
  age: number | null
  weight_kg: number | null
  gender: string | null
}

export interface ActiveProgramDayRow {
  label: string
  exercises: Array<{ muscle_group: string }>
}

export interface ActiveProgramRow {
  id: string
  name: string
  days: ActiveProgramDayRow[]
}

export interface RecentStatsRow {
  total_sessions: number
  // Per-set muscle group hits over the window; the builder aggregates +
  // sorts + truncates so the SQL layer can stay simple (one row per
  // muscle_group with a count).
  muscle_group_counts: Array<{ muscle_group: string; count: number }>
  // `null` when no sessions logged in the window.
  avg_session_duration_minutes: number | null
}

export interface BuildBundleDeps {
  fetchProfile: (userId: string) => Promise<ProfileRow | null>
  fetchActiveProgram: (userId: string) => Promise<ActiveProgramRow | null>
  fetchRecentStats: (
    userId: string,
    windowDays: number,
  ) => Promise<RecentStatsRow>
}

// --- Errors ---

// Builder bug: composed bundle exceeded the JSON size ceiling. Handler
// maps to 500. NEVER caused by user data alone — the bundle shape is
// bounded (5 days × 5 muscles, 5 top groups, scalar stats).
export class BundleSizeExceeded extends Error {
  constructor(public bytes: number) {
    super(`bundle JSON size ${bytes} exceeds ${BUNDLE_MAX_BYTES}`)
    this.name = "BundleSizeExceeded"
  }
}

// Defensive: a user reaching the additional-program flow without a
// `user_profiles` row is technically unreachable (onboarding writes it),
// but worth a typed signal so the handler can 409 cleanly instead of
// crashing on `profile.goal` access downstream.
export class ProfileMissing extends Error {
  constructor() {
    super("user_profiles row not found")
    this.name = "ProfileMissing"
  }
}

// --- Builder ---

export async function buildAdditionalProgramBundle(
  userId: string,
  deps: BuildBundleDeps,
  nowIso: string = new Date().toISOString(),
): Promise<AdditionalProgramBundle> {
  // Parallel fetches — the three queries are independent. If profile
  // throws or is null we bail early; the other two are awaited regardless
  // so we don't dangle promises (Deno warns and tests would flake).
  const [profileResult, activeProgramResult, recentStatsResult] =
    await Promise.allSettled([
      deps.fetchProfile(userId),
      deps.fetchActiveProgram(userId),
      deps.fetchRecentStats(userId, BUNDLE_WINDOW_DAYS),
    ])

  if (profileResult.status === "rejected") throw profileResult.reason
  if (profileResult.value === null) throw new ProfileMissing()

  if (activeProgramResult.status === "rejected") throw activeProgramResult.reason
  if (recentStatsResult.status === "rejected") throw recentStatsResult.reason

  const bundle: AdditionalProgramBundle = {
    v: BUNDLE_VERSION,
    captured_at: nowIso,
    profile: projectProfile(profileResult.value),
    active_program: activeProgramResult.value
      ? projectActiveProgram(activeProgramResult.value)
      : null,
    recent_stats: projectRecentStats(recentStatsResult.value),
  }

  // PR #350 review: count real UTF-8 bytes, not UTF-16 code units. Active
  // program names and day labels can carry non-ASCII (French accents,
  // emojis if a user is feeling spicy) — `.length` would undercount and
  // let the bundle slip past BUNDLE_MAX_BYTES while the error message
  // still claimed bytes. TextEncoder.encode is the canonical byte count.
  const bytes = new TextEncoder().encode(JSON.stringify(bundle)).length
  if (bytes > BUNDLE_MAX_BYTES) {
    throw new BundleSizeExceeded(bytes)
  }

  return bundle
}

// --- Projection helpers (pure, exported for unit tests) ---

function projectProfile(row: ProfileRow): BundleProfile {
  return {
    goal: row.goal,
    experience: row.experience,
    equipment: row.equipment,
    training_days_per_week: row.training_days_per_week,
    session_duration_minutes: row.session_duration_minutes,
    age: row.age,
    weight_kg: row.weight_kg,
    gender: row.gender,
  }
}

function projectActiveProgram(row: ActiveProgramRow): BundleActiveProgram {
  return {
    id: row.id,
    name: row.name,
    days: row.days.map((day) => ({
      label: day.label,
      exercise_count: day.exercises.length,
      muscle_groups: uniqueSortedMuscleGroups(day.exercises),
    })),
  }
}

function uniqueSortedMuscleGroups(
  exercises: Array<{ muscle_group: string }>,
): string[] {
  // Set + sort + slice — cheap, deterministic, and the cap is a hard
  // ceiling so even a 50-exercise day stays inside the 8 KB envelope.
  const unique = Array.from(new Set(exercises.map((e) => e.muscle_group)))
  unique.sort()
  return unique.slice(0, DAY_MUSCLE_GROUPS_LIMIT)
}

function projectRecentStats(row: RecentStatsRow): BundleRecentStats {
  const sessionsPerWeek = Math.round((row.total_sessions / 4) * 10) / 10

  return {
    window_days: BUNDLE_WINDOW_DAYS,
    total_sessions: row.total_sessions,
    sessions_per_week: sessionsPerWeek,
    top_muscle_groups: topMuscleGroups(row.muscle_group_counts),
    avg_session_duration_minutes: row.avg_session_duration_minutes,
  }
}

function topMuscleGroups(
  counts: Array<{ muscle_group: string; count: number }>,
): string[] {
  // Defensive copy before sort — we never mutate caller-owned data.
  // Secondary lexical sort makes the snapshot deterministic when two
  // muscle groups tie on count (otherwise stable-sort behavior would
  // leak DB row order into the prompt).
  return counts
    .slice()
    .sort((a, b) =>
      b.count - a.count !== 0
        ? b.count - a.count
        : a.muscle_group.localeCompare(b.muscle_group)
    )
    .slice(0, TOP_MUSCLE_GROUPS_LIMIT)
    .map((c) => c.muscle_group)
}

// --- Summary projection (handler `/open` response) ---

export interface BundleSummary {
  active_program_name?: string
  sessions_per_week: number
  top_muscle_group?: string
}

/**
 * Compact projection of the bundle for the `/open` response payload. The
 * UI uses this to render the "we're building on top of <X>" chip (T136);
 * the bundle itself stays server-side as a transcript dependency.
 *
 * Returns `null` when the persisted bundle is malformed or missing — the
 * UI degrades to no chip rather than rendering a broken state.
 */
export function buildBundleSummary(
  bundle: Record<string, unknown> | null,
): BundleSummary | null {
  if (!bundle) return null
  const ap = bundle.active_program as { name?: unknown } | null | undefined
  const stats = bundle.recent_stats as
    | { sessions_per_week?: unknown; top_muscle_groups?: unknown }
    | undefined
  const sessionsPerWeek = typeof stats?.sessions_per_week === "number"
    ? stats.sessions_per_week
    : 0
  const topMuscleGroups = Array.isArray(stats?.top_muscle_groups)
    ? stats?.top_muscle_groups as unknown[]
    : []
  const summary: BundleSummary = { sessions_per_week: sessionsPerWeek }
  if (ap && typeof ap.name === "string") summary.active_program_name = ap.name
  if (typeof topMuscleGroups[0] === "string") {
    summary.top_muscle_group = topMuscleGroups[0]
  }
  return summary
}
