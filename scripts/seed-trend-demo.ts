/**
 * Seed rich per-exercise history for visual review of the new
 * "Par exercice" scatter+trend chart (issue #366).
 *
 * Generates three exercises across the three chart variants:
 *   - Développé couché (weighted)   → e1RM scatter+trend, > 100 sets to test pagination
 *   - Tractions (bodyweight)        → reps scatter+trend
 *   - Gainage planche (duration)    → duration scatter+trend
 *
 * Includes a deliberate 8/8/8 → 10/4/4 sequence on Développé couché so you can
 * eyeball the trend NOT showing false progression.
 *
 * Usage:
 *   npx tsx scripts/seed-trend-demo.ts --user-id=<uuid>
 *
 * Re-run safe: removes its own previous rows by `workout_label_snapshot LIKE 'Trend demo%'`.
 * Leaves the regular `Local seed%` data alone.
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

const PREFIX = "Trend demo"
const LOCAL_DEFAULT_SUPABASE = "http://127.0.0.1:54321"
const LOCAL_DEMO_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

function parseUserId(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith("--user-id="))
  if (arg) return arg.split("=", 2)[1]?.trim()
  return process.env.SUPABASE_HISTORY_SEED_USER_ID?.trim()
}

function isLocalLoopback(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    return u.hostname === "127.0.0.1" || u.hostname === "localhost"
  } catch {
    return false
  }
}

function resolveServiceRoleKey(supabaseUrl: string): string {
  const override = process.env.SUPABASE_HISTORY_SEED_SERVICE_ROLE_KEY?.trim()
  if (override) return override
  if (isLocalLoopback(supabaseUrl)) return LOCAL_DEMO_SERVICE_ROLE
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) {
    console.error("Non-local URL requires SUPABASE_SERVICE_ROLE_KEY.")
    process.exit(1)
  }
  return key
}

function atDaysAgo(daysAgo: number, startHourUTC: number, durationMin: number) {
  const started = new Date()
  started.setUTCHours(startHourUTC, 0, 0, 0)
  started.setUTCDate(started.getUTCDate() - daysAgo)
  const finished = new Date(started.getTime() + durationMin * 60_000)
  return { started_at: started.toISOString(), finished_at: finished.toISOString() }
}

/** Deterministic PRNG so re-runs produce identical data. */
function mulberry32(seed: number) {
  let t = seed
  return () => {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260526)

interface SetSpec {
  reps?: number
  duration_seconds?: number | null
  weight: number
  was_pr?: boolean
}

interface SessionSpec {
  daysAgo: number
  exerciseName: string
  durationMin: number
  sets: SetSpec[]
}

/**
 * Développé couché: 40 sessions over 120 days, climbing 50 → 65 kg.
 * Includes a deliberate 8/8/8 → 10/4/4 pair around day 60 (counter-example for
 * the trend semantics) and a heavy-single + back-offs day around day 30.
 */
function bench(): SessionSpec[] {
  const out: SessionSpec[] = []
  const base = (i: number) => 50 + Math.floor((i / 40) * 15) + (rand() < 0.15 ? -2.5 : 0)
  // Spread 40 sessions across 120 days, roughly every 3 days with jitter.
  for (let i = 0; i < 40; i++) {
    const daysAgo = Math.max(0, 120 - i * 3 - Math.floor(rand() * 2))
    const w = base(i)

    // Special scenarios.
    if (i === 25) {
      // 8/8/8 consistent day at 60 kg.
      out.push({
        daysAgo,
        exerciseName: "Développé couché",
        durationMin: 55,
        sets: [
          { reps: 8, weight: 60 },
          { reps: 8, weight: 60 },
          { reps: 8, weight: 60 },
        ],
      })
      continue
    }
    if (i === 26) {
      // 10/4/4 fluky day at 60 kg — should NOT show progression on the trend.
      out.push({
        daysAgo,
        exerciseName: "Développé couché",
        durationMin: 50,
        sets: [
          { reps: 10, weight: 60 },
          { reps: 4, weight: 60 },
          { reps: 4, weight: 60 },
        ],
      })
      continue
    }
    if (i === 32) {
      // Heavy single + back-offs.
      out.push({
        daysAgo,
        exerciseName: "Développé couché",
        durationMin: 65,
        sets: [
          { reps: 3, weight: 70, was_pr: true },
          { reps: 8, weight: 60 },
          { reps: 8, weight: 60 },
        ],
      })
      continue
    }

    // Standard session: 3-4 sets at the working weight, with rep variance.
    const setCount = rand() < 0.3 ? 4 : 3
    const baseReps = rand() < 0.5 ? 8 : 6
    const sets: SetSpec[] = Array.from({ length: setCount }, (_, s) => {
      const dropoff = s === 0 ? 0 : Math.floor(rand() * 2)
      return { reps: Math.max(3, baseReps - dropoff), weight: w }
    })
    out.push({
      daysAgo,
      exerciseName: "Développé couché",
      durationMin: 45 + Math.floor(rand() * 20),
      sets,
    })
  }
  return out
}

/** Tractions: 25 sessions over 90 days, reps climbing 5 → 10. */
function pullups(): SessionSpec[] {
  const out: SessionSpec[] = []
  for (let i = 0; i < 25; i++) {
    const daysAgo = Math.max(0, 90 - i * 3 - Math.floor(rand() * 2))
    const peak = Math.min(11, 5 + Math.floor(i / 3))
    const setCount = 3
    // Fluky day at i=18: one big set then collapse.
    const sets: SetSpec[] =
      i === 18
        ? [
            { reps: 12, weight: 0 },
            { reps: 4, weight: 0 },
            { reps: 3, weight: 0 },
          ]
        : Array.from({ length: setCount }, (_, s) => ({
            reps: Math.max(2, peak - s - Math.floor(rand() * 2)),
            weight: 0,
          }))
    out.push({
      daysAgo,
      exerciseName: "Tractions",
      durationMin: 30 + Math.floor(rand() * 10),
      sets,
    })
  }
  return out
}

/** Gainage planche: 20 sessions over 90 days, duration climbing 25s → 90s. */
function plank(): SessionSpec[] {
  const out: SessionSpec[] = []
  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.max(0, 90 - i * 4 - Math.floor(rand() * 2))
    const peak = Math.min(120, 25 + i * 4)
    const sets: SetSpec[] = [
      { duration_seconds: peak - Math.floor(rand() * 5), weight: 0 },
      { duration_seconds: Math.max(15, peak - 15 - Math.floor(rand() * 10)), weight: 0 },
    ]
    out.push({
      daysAgo,
      exerciseName: "Gainage planche",
      durationMin: 20,
      sets,
    })
  }
  return out
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_HISTORY_SEED_URL?.trim() || LOCAL_DEFAULT_SUPABASE
  const userId = parseUserId()
  if (!userId) {
    console.error("Missing user id. Pass --user-id=<uuid>.")
    process.exit(1)
  }

  console.log(`[seed:trend-demo] ${supabaseUrl}`)
  const admin = createClient(supabaseUrl, resolveServiceRoleKey(supabaseUrl), {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient

  const { data: user, error: userErr } = await admin.auth.admin.getUserById(userId)
  if (userErr || !user?.user) {
    console.error(`User ${userId} not found:`, userErr?.message)
    process.exit(1)
  }

  // Clear previous trend-demo rows.
  const { error: delErr } = await admin
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .like("workout_label_snapshot", `${PREFIX}%`)
  if (delErr) {
    console.error("Failed to clear previous trend-demo rows:", delErr.message)
    process.exit(1)
  }

  // Resolve exercise ids.
  const names = ["Développé couché", "Tractions", "Gainage planche"] as const
  const ids: Record<string, string> = {}
  for (const name of names) {
    const { data, error } = await admin
      .from("exercises")
      .select("id")
      .eq("name", name)
      .maybeSingle()
    if (error || !data) {
      console.error(`Exercise not found: "${name}". Run \`supabase db reset\` first.`)
      process.exit(1)
    }
    ids[name] = data.id
  }

  const specs = [...bench(), ...pullups(), ...plank()]
  let inserted = 0

  for (const spec of specs) {
    const { started_at, finished_at } = atDaysAgo(
      spec.daysAgo,
      8 + Math.floor(rand() * 10),
      spec.durationMin,
    )
    const { data: session, error: sErr } = await admin
      .from("sessions")
      .insert({
        user_id: userId,
        workout_day_id: null,
        workout_label_snapshot: `${PREFIX} — ${spec.exerciseName}`,
        started_at,
        finished_at,
        active_duration_ms: spec.durationMin * 60_000,
        total_sets_done: spec.sets.length,
        has_skipped_sets: false,
        cycle_id: null,
      })
      .select("id")
      .single()
    if (sErr || !session) {
      console.error("Insert session failed:", sErr?.message)
      process.exit(1)
    }

    const sessionStartMs = Date.parse(started_at)
    const logs = spec.sets.map((s, idx) => ({
      session_id: session.id,
      exercise_id: ids[spec.exerciseName]!,
      exercise_name_snapshot: spec.exerciseName,
      set_number: idx + 1,
      reps_logged: s.reps != null ? String(s.reps) : null,
      duration_seconds: s.duration_seconds ?? null,
      weight_logged: s.weight,
      estimated_1rm: null,
      was_pr: s.was_pr ?? false,
      rir: null,
      // Each set ~90s after the previous one — otherwise logged_at defaults to now()
      // and the chart shows all dots stacked on today.
      logged_at: new Date(sessionStartMs + (idx + 1) * 90_000).toISOString(),
    }))
    const { error: lErr } = await admin.from("set_logs").insert(logs)
    if (lErr) {
      console.error("Insert set_logs failed:", lErr.message)
      process.exit(1)
    }
    inserted++
  }

  const totalSets = specs.reduce((n, s) => n + s.sets.length, 0)
  console.log(
    `[seed:trend-demo] Inserted ${inserted} sessions / ${totalSets} sets for ${user.user.email ?? userId}.\n` +
      `Open /history → Par exercice and pick:\n` +
      `  • Développé couché  (e1RM scatter+trend, > 100 sets, 8/8/8 → 10/4/4 around mid-history)\n` +
      `  • Tractions          (reps variant)\n` +
      `  • Gainage planche    (duration variant)`,
  )
}

main()
