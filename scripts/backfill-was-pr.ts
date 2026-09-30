/**
 * Recompute set_logs.was_pr using the same rules as file:src/lib/prDetection.ts
 * (first session per user+exercise = baseline; then strict PR by modality).
 *
 * Groups by `user_id::exercise_id` across ALL finished set_logs — including
 * Circuit stations (`block_exercise_id` set). Do not filter those out: a loaded
 * deadlift in a Circuit shares the same Profil PR stream as solo deadlifts.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL in .env
 *
 *   npm run backfill:was-pr                      # dry-run stats only
 *   npx tsx scripts/backfill-was-pr.ts --apply   # write was_pr + optional re-grant
 *
 * Production (ignore .env.local so local Supabase does not win):
 *   npx tsx scripts/backfill-was-pr.ts --no-env-local --apply
 *
 * Scoped re-derivation (#569) — recompute the affected users' whole PR stream,
 * which is the only correct unit: a recovered session changes the running best
 * that LATER sessions on the same exercise were compared against, so writing
 * just the recovered rows would leave stale `was_pr` downstream. `--users`
 * bounds the read + write + re-grant; `--sessions` only resolves/validates the
 * owners and warns when a given row is absent.
 *
 *   npx tsx scripts/backfill-was-pr.ts --no-env-local \
 *     --sessions <uuid,…> --users <uuid,…> --apply --regrant
 *
 * Only rows whose value actually changes are written, so a second run is a
 * no-op. With `--sessions` given but unreadable, the script fails closed rather
 * than widening to the whole table. Without any flag: whole history, as before.
 *
 * Do not run --apply against production from the Circuit was_pr ticket.
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

function argList(flag: string): string[] {
  const i = process.argv.indexOf(flag)
  if (i === -1) return []
  const raw = process.argv[i + 1]
  if (!raw || raw.startsWith("--")) {
    console.error(`${flag} needs a comma-separated value`)
    process.exit(1)
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

let SCOPE_USERS = argList("--users")
const SCOPE_SESSIONS = new Set(argList("--sessions"))

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
  was_pr: boolean
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
      // Unique tiebreak: without it, LIMIT/OFFSET pages can drop or repeat rows.
      .order("id", { ascending: true })
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
  // Supabase caps a response at 1000 rows regardless of the requested range,
  // so a larger page size makes `rows.length < pageSize` fire on page 1 and
  // silently truncates the scan. Keep the page at the cap to actually page.
  const pageSize = 1000
  let from = 0
  for (;;) {
    let query = supabase
      .from("set_logs")
      .select(
        "id, session_id, exercise_id, reps_logged, weight_logged, estimated_1rm, duration_seconds, logged_at, set_number, was_pr, sessions!inner(user_id, started_at, finished_at)",
      )
    if (SCOPE_USERS.length > 0) query = query.in("sessions.user_id", SCOPE_USERS)
    const { data, error } = await query
      .order("logged_at", { ascending: true })
      // Unique tiebreak: bulk-inserted logs share a `logged_at`, and unstable
      // page order can drop a row (wrong running best) or repeat one.
      .order("id", { ascending: true })
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

async function allUserIds(): Promise<string[]> {
  const out: string[] = []
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw error
    const users = data.users ?? []
    if (users.length === 0) break
    out.push(...users.map((u) => u.id))
    if (users.length < 1000) break
    page += 1
  }
  return out
}

/**
 * Resolve the scope from `--sessions` / `--users`. Fails closed: a mistyped
 * `--sessions` must never silently widen the run to the whole table.
 */
async function resolveScope(): Promise<void> {
  if (SCOPE_SESSIONS.size === 0) return

  const { data, error } = await supabase
    .from("sessions")
    .select("id, user_id")
    .in("id", [...SCOPE_SESSIONS])
  if (error) throw error

  const rows = data ?? []
  if (rows.length === 0) {
    throw new Error(
      "--sessions matched no session — refusing to widen to the whole table. Check the ids.",
    )
  }
  if (rows.length !== SCOPE_SESSIONS.size) {
    console.warn(
      `Warning: ${rows.length}/${SCOPE_SESSIONS.size} session id(s) resolved in this project`,
    )
  }

  const owners = [...new Set(rows.map((s) => s.user_id))]
  if (SCOPE_USERS.length === 0) {
    SCOPE_USERS = owners
  } else {
    const missing = owners.filter((u) => !SCOPE_USERS.includes(u))
    if (missing.length > 0) {
      throw new Error(
        `--users omits the owner of some --sessions: ${missing.join(", ")}`,
      )
    }
  }
}

async function main() {
  console.log(APPLY ? "APPLY mode" : "DRY RUN")

  await resolveScope()

  if (SCOPE_SESSIONS.size > 0 || SCOPE_USERS.length > 0) {
    console.log(
      `Scope: ${SCOPE_SESSIONS.size || "all"} session(s), ${SCOPE_USERS.length || "all"} user(s)`,
    )
  }

  const exerciseMap = await loadExercises()
  const logs = await loadFinishedSetLogs()
  console.log(`Loaded ${logs.length} finished set_logs rows`)

  if (SCOPE_SESSIONS.size > 0) {
    const present = new Set(logs.map((l) => l.session_id))
    const missing = [...SCOPE_SESSIONS].filter((id) => !present.has(id))
    if (missing.length > 0) {
      console.warn(
        `Warning: ${missing.length} targeted session(s) had no finished set_logs (backfill not applied yet?): ${missing.join(", ")}`,
      )
    }
  }

  const groups = new Map<string, LogRow[]>()
  for (const r of logs) {
    const s = normalizeSession(r.sessions)
    if (!s) continue
    const key = `${s.user_id}::${r.exercise_id}`
    const list = groups.get(key) ?? []
    list.push(r)
    groups.set(key, list)
  }

  // The correct write unit is the whole scoped stream, not just the recovered
  // sessions: a recovered set changes the running best later sets were compared
  // against. Change-only writes keep that re-derivation safe and idempotent.
  const updates: { id: string; was_pr: boolean }[] = []
  let computed = 0
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

      computed += 1
      if (wasPr) wouldBeTrue += 1
      if (r.was_pr !== wasPr) updates.push({ id: r.id, was_pr: wasPr })
    }
  }

  console.log(
    `Computed ${computed} row(s); ${wouldBeTrue} with was_pr=true; ${updates.length} differ from stored`,
  )

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
    const userIds = SCOPE_USERS.length > 0 ? SCOPE_USERS : await allUserIds()
    let done = 0
    for (const id of userIds) {
      const { error: rpcErr } = await supabase.rpc(
        "check_and_grant_achievements",
        { p_user_id: id },
      )
      if (rpcErr) console.error("RPC failed for", id, rpcErr.message)
      done += 1
    }
    console.log("Re-grant RPC invoked for", done, "users")
  } else {
    console.log("Skip RPC re-grant (pass --regrant to call check_and_grant_achievements)")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
