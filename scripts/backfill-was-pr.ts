/**
 * Recompute set_logs.was_pr using the same rules as file:src/lib/prDetection.ts
 * (first session per user+exercise = baseline; then strict PR by modality).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL in .env
 *
 *   npx tsx scripts/backfill-was-pr.ts           # dry-run stats only
 *   npx tsx scripts/backfill-was-pr.ts --apply   # write was_pr + optional re-grant
 *
 * Production (ignore .env.local so local Supabase does not win):
 *   npx tsx scripts/backfill-was-pr.ts --no-env-local --apply
 *
 * Run migration 20260403100000_pr_record_hunter_reset.sql (or let supabase db push)
 * before --apply if you want Record Hunter cleared first.
 */
import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import {
  getPrModality,
  scoreSetLogRow,
  type ExercisePrMeta,
} from "../src/lib/prDetection"

const APPLY = process.argv.includes("--apply")
const REGRANT = process.argv.includes("--regrant")

const url = process.env.VITE_SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

type SessionEmbed = {
  user_id: string
  started_at: string
  finished_at: string | null
}

type LogRow = {
  id: string
  session_id: string
  exercise_id: string
  reps_logged: string | null
  weight_logged: number
  estimated_1rm: number | null
  duration_seconds: number | null
  logged_at: string
  set_number: number
  sessions: SessionEmbed | SessionEmbed[] | null
}

function normalizeSession(s: SessionEmbed | SessionEmbed[] | null): SessionEmbed | null {
  if (!s) return null
  return Array.isArray(s) ? s[0] ?? null : s
}

function exerciseMeta(
  exerciseId: string,
  map: Map<string, { measurement_type?: string | null; equipment?: string | null }>,
): ExercisePrMeta {
  const e = map.get(exerciseId)
  return {
    measurement_type:
      e?.measurement_type === "duration"
        ? "duration"
        : e?.measurement_type === "reps"
          ? "reps"
          : "reps",
    equipment: e?.equipment ?? null,
  }
}

function firstSessionIdForGroup(rows: LogRow[]): string | null {
  let minT = Infinity
  const atMin = new Set<string>()
  for (const r of rows) {
    const s = normalizeSession(r.sessions)
    if (!s) continue
    const t = new Date(s.started_at).getTime()
    if (t < minT) {
      minT = t
      atMin.clear()
      atMin.add(r.session_id)
    } else if (t === minT) {
      atMin.add(r.session_id)
    }
  }
  if (atMin.size === 0) return null
  return [...atMin].sort()[0]!
}

async function loadExercises() {
  const map = new Map<
    string,
    { measurement_type?: string | null; equipment?: string | null }
  >()
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from("exercises")
      .select("id, measurement_type, equipment")
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    for (const e of data) {
      map.set(e.id, {
        measurement_type: e.measurement_type,
        equipment: e.equipment,
      })
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return map
}

async function loadFinishedSetLogs(): Promise<LogRow[]> {
  const out: LogRow[] = []
  const pageSize = 2000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from("set_logs")
      .select(
        "id, session_id, exercise_id, reps_logged, weight_logged, estimated_1rm, duration_seconds, logged_at, set_number, sessions!inner(user_id, started_at, finished_at)",
      )
      .order("logged_at", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    const rows = data as LogRow[]
    for (const r of rows) {
      const s = normalizeSession(r.sessions)
      if (s?.finished_at) out.push(r)
    }
    if (rows.length < pageSize) break
    from += pageSize
  }
  return out
}

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size))
  }
  return res
}

async function main() {
  console.log(APPLY ? "APPLY mode" : "DRY RUN")

  const exerciseMap = await loadExercises()
  const logs = await loadFinishedSetLogs()
  console.log(`Loaded ${logs.length} finished set_logs rows`)

  const groups = new Map<string, LogRow[]>()
  for (const r of logs) {
    const s = normalizeSession(r.sessions)
    if (!s) continue
    const key = `${s.user_id}::${r.exercise_id}`
    const list = groups.get(key) ?? []
    list.push(r)
    groups.set(key, list)
  }

  const updates: { id: string; was_pr: boolean }[] = []
  let wouldBeTrue = 0

  for (const [, rows] of groups) {
    rows.sort((a, b) => {
      const dt =
        new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
      if (dt !== 0) return dt
      return a.set_number - b.set_number
    })

    const firstSid = firstSessionIdForGroup(rows)
    let runningBest = 0

    for (const r of rows) {
      const modality = getPrModality(exerciseMeta(r.exercise_id, exerciseMap))
      const score = scoreSetLogRow(r, modality)
      const isBaseline = firstSid != null && r.session_id === firstSid
      const wasPr = !isBaseline && score > runningBest && score > 0
      runningBest = Math.max(runningBest, score)
      updates.push({ id: r.id, was_pr: wasPr })
      if (wasPr) wouldBeTrue += 1
    }
  }

  console.log(`Computed ${updates.length} rows; ${wouldBeTrue} with was_pr=true`)

  if (!APPLY) {
    console.log("Done (dry run). Pass --apply to write.")
    return
  }

  let written = 0
  for (const batch of chunk(updates, 80)) {
    const results = await Promise.all(
      batch.map((u) =>
        supabase.from("set_logs").update({ was_pr: u.was_pr }).eq("id", u.id),
      ),
    )
    for (const res of results) {
      if (res.error) throw res.error
    }
    written += batch.length
  }
  console.log(`Updated ${written} set_logs`)

  if (REGRANT) {
    let page = 1
    let total = 0
    for (;;) {
      const { data, error: uErr } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      })
      if (uErr) throw uErr
      const users = data.users ?? []
      if (users.length === 0) break
      for (const u of users) {
        const { error: rpcErr } = await supabase.rpc(
          "check_and_grant_achievements",
          { p_user_id: u.id },
        )
        if (rpcErr) console.error("RPC failed for", u.id, rpcErr.message)
        total += 1
      }
      if (users.length < 1000) break
      page += 1
    }
    console.log("Re-grant RPC invoked for", total, "users")
  } else {
    console.log("Skip RPC re-grant (pass --regrant to call check_and_grant_achievements)")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
