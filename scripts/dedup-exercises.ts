/**
 * One-shot deduplication of exercises with identical names.
 * Dry-run by default — pass --apply to execute mutations.
 *
 * For each group of duplicates (same `name`, count > 1):
 *   1. Scores each row to pick the "keeper" (most enriched data wins)
 *   2. Reassigns FK references in workout_exercises and set_logs
 *   3. Deletes the duplicate rows
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import { enrichmentConfig } from "./enrichment-config.js"

const SUPABASE_URL = enrichmentConfig.supabaseUrl
const SERVICE_ROLE_KEY = enrichmentConfig.supabaseServiceRoleKey

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const DRY_RUN = !process.argv.includes("--apply")

// ---------- Types ----------

interface ExerciseRow {
  id: string
  name: string
  is_system: boolean
  source: string | null
  youtube_url: string | null
  instructions: unknown | null
  image_url: string | null
  created_at: string
}

// ---------- Scoring ----------

function score(row: ExerciseRow): number {
  let s = 0
  if (row.is_system) s += 5
  if (row.instructions != null) s += 3
  if (row.youtube_url) s += 2
  if (row.image_url) s += 1
  if (row.source) s += 1
  return s
}

function pickKeeper(group: ExerciseRow[]): { keeper: ExerciseRow; duplicates: ExerciseRow[] } {
  const sorted = [...group].sort((a, b) => {
    const diff = score(b) - score(a)
    if (diff !== 0) return diff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  return { keeper: sorted[0], duplicates: sorted.slice(1) }
}

// ---------- Main ----------

async function run() {
  console.log(`=== Exercise Deduplication${DRY_RUN ? " (DRY RUN)" : ""} ===\n`)

  const { data: allExercises, error } = await supabase
    .from("exercises")
    .select("id, name, is_system, source, youtube_url, instructions, image_url, created_at")
    .order("created_at", { ascending: true })

  if (error || !allExercises) {
    console.error("Failed to fetch exercises:", error?.message)
    process.exit(1)
  }

  const byName = new Map<string, ExerciseRow[]>()
  for (const row of allExercises as ExerciseRow[]) {
    const existing = byName.get(row.name)
    if (existing) {
      existing.push(row)
    } else {
      byName.set(row.name, [row])
    }
  }

  const duplicateGroups = [...byName.entries()].filter(([, group]) => group.length > 1)

  if (duplicateGroups.length === 0) {
    console.log("No duplicates found.")
    return
  }

  console.log(`Found ${duplicateGroups.length} duplicate groups:\n`)

  let totalDeleted = 0
  let totalFkReassigned = 0

  for (const [name, group] of duplicateGroups) {
    const { keeper, duplicates } = pickKeeper(group)
    const dupIds = duplicates.map((d) => d.id)

    console.log(`"${name}" — ${group.length} rows`)
    console.log(`  KEEP  ${keeper.id} (score=${score(keeper)}, source=${keeper.source ?? "null"})`)
    for (const d of duplicates) {
      console.log(`  DROP  ${d.id} (score=${score(d)}, source=${d.source ?? "null"})`)
    }

    if (!DRY_RUN) {
      for (const dupId of dupIds) {
        const { data: weData } = await supabase
          .from("workout_exercises")
          .update({ exercise_id: keeper.id })
          .eq("exercise_id", dupId)
          .select("id")

        const { data: slData } = await supabase
          .from("set_logs")
          .update({ exercise_id: keeper.id })
          .eq("exercise_id", dupId)
          .select("id")

        const reassigned = (weData?.length ?? 0) + (slData?.length ?? 0)
        if (reassigned > 0) {
          console.log(`  Reassigned ${reassigned} FK reference(s) from ${dupId} → ${keeper.id}`)
          totalFkReassigned += reassigned
        }
      }

      const { error: delErr } = await supabase
        .from("exercises")
        .delete()
        .in("id", dupIds)

      if (delErr) {
        console.error(`  DELETE failed: ${delErr.message}`)
      } else {
        console.log(`  Deleted ${dupIds.length} duplicate(s)`)
        totalDeleted += dupIds.length
      }
    }

    console.log()
  }

  console.log("=== Summary ===")
  console.log(`Duplicate groups: ${duplicateGroups.length}`)
  if (DRY_RUN) {
    const wouldDelete = duplicateGroups.reduce((sum, [, g]) => sum + g.length - 1, 0)
    console.log(`Would delete: ${wouldDelete} rows`)
    console.log("\nRe-run with --apply to execute.")
  } else {
    console.log(`Deleted: ${totalDeleted}`)
    console.log(`FK references reassigned: ${totalFkReassigned}`)
  }
}

run().catch((err) => {
  console.error("Dedup failed:", err)
  process.exit(1)
})
