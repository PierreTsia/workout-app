import {
  assertEquals,
  assertExists,
  assertRejects,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts"
import {
  BUNDLE_MAX_BYTES,
  BUNDLE_VERSION,
  BUNDLE_WINDOW_DAYS,
  BundleSizeExceeded,
  buildAdditionalProgramBundle,
  buildBundleSummary,
  ProfileMissing,
  type ActiveProgramRow,
  type BuildBundleDeps,
  type ProfileRow,
  type RecentStatsRow,
} from "./bundle.ts"

// ---------- fixtures + DI factory ----------

function makeProfileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    goal: "hypertrophy",
    experience: "intermediate",
    equipment: "gym",
    training_days_per_week: 4,
    session_duration_minutes: 60,
    age: 30,
    weight_kg: 75,
    gender: "male",
    ...overrides,
  }
}

function makeActiveProgramRow(
  overrides: Partial<ActiveProgramRow> = {},
): ActiveProgramRow {
  return {
    id: "prog-1",
    name: "Push Pull Legs",
    days: [
      {
        label: "Push",
        exercises: [
          { muscle_group: "chest" },
          { muscle_group: "shoulders" },
          { muscle_group: "triceps" },
          { muscle_group: "chest" }, // dedup target
        ],
      },
      {
        label: "Pull",
        exercises: [
          { muscle_group: "back" },
          { muscle_group: "biceps" },
        ],
      },
      {
        label: "Legs",
        exercises: [
          { muscle_group: "quads" },
          { muscle_group: "hamstrings" },
          { muscle_group: "glutes" },
          { muscle_group: "calves" },
        ],
      },
    ],
    ...overrides,
  }
}

function makeRecentStatsRow(
  overrides: Partial<RecentStatsRow> = {},
): RecentStatsRow {
  return {
    total_sessions: 12,
    muscle_group_counts: [
      { muscle_group: "chest", count: 24 },
      { muscle_group: "back", count: 22 },
      { muscle_group: "quads", count: 18 },
      { muscle_group: "shoulders", count: 16 },
      { muscle_group: "triceps", count: 12 },
      { muscle_group: "biceps", count: 10 },
      { muscle_group: "hamstrings", count: 8 },
    ],
    avg_session_duration_minutes: 58,
    ...overrides,
  }
}

interface DepsCalls {
  fetchProfile: string[]
  fetchActiveProgram: string[]
  fetchRecentStats: Array<{ userId: string; windowDays: number }>
}

function makeDeps(
  overrides: Partial<BuildBundleDeps> = {},
): { deps: BuildBundleDeps; calls: DepsCalls } {
  const calls: DepsCalls = {
    fetchProfile: [],
    fetchActiveProgram: [],
    fetchRecentStats: [],
  }
  const deps: BuildBundleDeps = {
    fetchProfile: async (userId) => {
      calls.fetchProfile.push(userId)
      return overrides.fetchProfile
        ? await overrides.fetchProfile(userId)
        : makeProfileRow()
    },
    fetchActiveProgram: async (userId) => {
      calls.fetchActiveProgram.push(userId)
      return overrides.fetchActiveProgram
        ? await overrides.fetchActiveProgram(userId)
        : makeActiveProgramRow()
    },
    fetchRecentStats: async (userId, windowDays) => {
      calls.fetchRecentStats.push({ userId, windowDays })
      return overrides.fetchRecentStats
        ? await overrides.fetchRecentStats(userId, windowDays)
        : makeRecentStatsRow()
    },
  }
  return { deps, calls }
}

// ---------- happy path ----------

Deno.test("buildAdditionalProgramBundle returns a populated bundle with active program", async () => {
  const { deps, calls } = makeDeps()

  const bundle = await buildAdditionalProgramBundle(
    "user-1",
    deps,
    "2026-05-12T12:00:00.000Z",
  )

  assertEquals(bundle.v, BUNDLE_VERSION)
  assertEquals(bundle.captured_at, "2026-05-12T12:00:00.000Z")

  // Profile is a verbatim projection of the row.
  assertEquals(bundle.profile, {
    goal: "hypertrophy",
    experience: "intermediate",
    equipment: "gym",
    training_days_per_week: 4,
    session_duration_minutes: 60,
    age: 30,
    weight_kg: 75,
    gender: "male",
  })

  // Active program: muscle groups are unique + sorted asc, exercise_count is set length.
  assertExists(bundle.active_program)
  assertEquals(bundle.active_program?.id, "prog-1")
  assertEquals(bundle.active_program?.name, "Push Pull Legs")
  assertEquals(bundle.active_program?.days, [
    {
      label: "Push",
      exercise_count: 4,
      muscle_groups: ["chest", "shoulders", "triceps"], // deduped + sorted asc
    },
    {
      label: "Pull",
      exercise_count: 2,
      muscle_groups: ["back", "biceps"],
    },
    {
      label: "Legs",
      exercise_count: 4,
      muscle_groups: ["calves", "glutes", "hamstrings", "quads"],
    },
  ])

  // Recent stats: top 5 by count desc, sessions_per_week = 12/4 = 3.0.
  assertEquals(bundle.recent_stats, {
    window_days: BUNDLE_WINDOW_DAYS,
    total_sessions: 12,
    sessions_per_week: 3,
    top_muscle_groups: ["chest", "back", "quads", "shoulders", "triceps"],
    avg_session_duration_minutes: 58,
  })

  // DI: exactly one call to each fetcher, window plumbed through.
  assertEquals(calls.fetchProfile, ["user-1"])
  assertEquals(calls.fetchActiveProgram, ["user-1"])
  assertEquals(calls.fetchRecentStats, [{ userId: "user-1", windowDays: 28 }])
})

Deno.test("buildAdditionalProgramBundle caps a day's muscle_groups at 5 unique entries", async () => {
  const big = makeActiveProgramRow({
    days: [
      {
        label: "Full body",
        exercises: [
          { muscle_group: "a" },
          { muscle_group: "b" },
          { muscle_group: "c" },
          { muscle_group: "d" },
          { muscle_group: "e" },
          { muscle_group: "f" },
          { muscle_group: "g" },
        ],
      },
    ],
  })
  const { deps } = makeDeps({
    fetchActiveProgram: async () => big,
  })

  const bundle = await buildAdditionalProgramBundle("user-1", deps)

  assertEquals(bundle.active_program?.days[0].muscle_groups, [
    "a",
    "b",
    "c",
    "d",
    "e",
  ])
  // exercise_count stays accurate even when muscle_groups is truncated.
  assertEquals(bundle.active_program?.days[0].exercise_count, 7)
})

Deno.test("buildAdditionalProgramBundle rounds sessions_per_week to 1 decimal", async () => {
  // 11 sessions / 4 weeks = 2.75 → 2.8
  const { deps } = makeDeps({
    fetchRecentStats: async () =>
      makeRecentStatsRow({ total_sessions: 11 }),
  })

  const bundle = await buildAdditionalProgramBundle("user-1", deps)

  assertEquals(bundle.recent_stats.sessions_per_week, 2.8)
})

Deno.test("buildAdditionalProgramBundle tie-breaks top_muscle_groups deterministically (lexical)", async () => {
  const { deps } = makeDeps({
    fetchRecentStats: async () =>
      makeRecentStatsRow({
        muscle_group_counts: [
          { muscle_group: "shoulders", count: 10 },
          { muscle_group: "back", count: 10 },
          { muscle_group: "chest", count: 10 },
        ],
      }),
  })

  const bundle = await buildAdditionalProgramBundle("user-1", deps)

  assertEquals(bundle.recent_stats.top_muscle_groups, ["back", "chest", "shoulders"])
})

// ---------- no active program ----------

Deno.test("buildAdditionalProgramBundle returns active_program=null when the user has no active program", async () => {
  const { deps } = makeDeps({
    fetchActiveProgram: async () => null,
  })

  const bundle = await buildAdditionalProgramBundle("user-1", deps)

  assertStrictEquals(bundle.active_program, null)
  // Other fields still populated from the same fetch.
  assertEquals(bundle.profile.goal, "hypertrophy")
  assertEquals(bundle.recent_stats.total_sessions, 12)
})

// ---------- no sessions in window ----------

Deno.test("buildAdditionalProgramBundle handles zero sessions in the 28d window", async () => {
  const { deps } = makeDeps({
    fetchRecentStats: async () => ({
      total_sessions: 0,
      muscle_group_counts: [],
      avg_session_duration_minutes: null,
    }),
  })

  const bundle = await buildAdditionalProgramBundle("user-1", deps)

  assertEquals(bundle.recent_stats, {
    window_days: BUNDLE_WINDOW_DAYS,
    total_sessions: 0,
    sessions_per_week: 0,
    top_muscle_groups: [],
    avg_session_duration_minutes: null,
  })
})

// ---------- size guard ----------

Deno.test("buildAdditionalProgramBundle throws BundleSizeExceeded when JSON would exceed 8 KB", async () => {
  // Force a bloated profile field — the projection blindly copies strings
  // so a 10 KB `goal` value blows through the cap. Exercising the guard
  // via a contrived fixture instead of a "realistic" 8 KB scenario keeps
  // the test fast and explicit.
  const huge = "x".repeat(BUNDLE_MAX_BYTES + 100)
  const { deps } = makeDeps({
    fetchProfile: async () => makeProfileRow({ goal: huge }),
  })

  await assertRejects(
    () => buildAdditionalProgramBundle("user-1", deps),
    BundleSizeExceeded,
  )
})

// PR #350 review: the size guard must count UTF-8 bytes, not UTF-16
// code units. A string of 4500 × `é` is 4500 code units (`.length` =
// 4500, well under 8192) but 9000 UTF-8 bytes — over the cap. The old
// `.length`-based guard would have let this through; the
// `TextEncoder`-based guard catches it.
Deno.test("buildAdditionalProgramBundle counts UTF-8 bytes, not JS string length, against the size cap", async () => {
  const multiByte = "é".repeat(4500)
  const { deps } = makeDeps({
    fetchProfile: async () => makeProfileRow({ goal: multiByte }),
  })

  await assertRejects(
    () => buildAdditionalProgramBundle("user-1", deps),
    BundleSizeExceeded,
  )
})

// ---------- missing profile ----------

Deno.test("buildAdditionalProgramBundle throws ProfileMissing when the profile fetcher returns null", async () => {
  const { deps } = makeDeps({
    fetchProfile: async () => null,
  })

  await assertRejects(
    () => buildAdditionalProgramBundle("user-1", deps),
    ProfileMissing,
  )
})

// ---------- buildBundleSummary ----------

Deno.test("buildBundleSummary projects an active-program bundle into the chip payload", () => {
  const bundle = {
    v: 1,
    captured_at: "2026-05-12T12:00:00Z",
    profile: {},
    active_program: { id: "p-1", name: "Push Pull Legs", days: [] },
    recent_stats: {
      window_days: 28,
      total_sessions: 12,
      sessions_per_week: 3,
      top_muscle_groups: ["chest", "back"],
      avg_session_duration_minutes: 58,
    },
  }

  const summary = buildBundleSummary(bundle as Record<string, unknown>)

  assertEquals(summary, {
    active_program_name: "Push Pull Legs",
    sessions_per_week: 3,
    top_muscle_group: "chest",
  })
})

Deno.test("buildBundleSummary omits active_program_name when bundle.active_program is null", () => {
  const summary = buildBundleSummary({
    v: 1,
    captured_at: "2026-05-12T12:00:00Z",
    profile: {},
    active_program: null,
    recent_stats: {
      window_days: 28,
      total_sessions: 0,
      sessions_per_week: 0,
      top_muscle_groups: [],
      avg_session_duration_minutes: null,
    },
  })

  assertEquals(summary, { sessions_per_week: 0 })
})

Deno.test("buildBundleSummary returns null for a null bundle (no chip)", () => {
  assertStrictEquals(buildBundleSummary(null), null)
})
