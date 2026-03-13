/**
 * Delete exercises listed in delete_candidates.csv from Supabase.
 * Skips any exercise referenced by workout_exercises or set_logs (FK would block anyway).
 *
 * Usage: npx tsx scripts/delete-exercises.ts [--input=delete_candidates.csv] [--dry-run]
 */

import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const dryRun = process.argv.includes("--dry-run")

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur)
      cur = ""
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

async function main() {
  const inputArg = process.argv.find((a) => a.startsWith("--input="))
  const inputPath = inputArg
    ? path.resolve(process.cwd(), inputArg.slice("--input=".length))
    : path.join(root, "delete_candidates.csv")

  if (!fs.existsSync(inputPath)) {
    console.error("File not found:", inputPath)
    process.exit(1)
  }

  const lines = fs.readFileSync(inputPath, "utf-8").split(/\r?\n/).filter(Boolean)
  const headers = parseCsvLine(lines[0])
  const idIdx = headers.indexOf("id")
  const nameIdx = headers.indexOf("name")

  if (idIdx < 0) {
    console.error("CSV must have an 'id' column")
    process.exit(1)
  }

  const candidates = lines.slice(1).map((l) => {
    const cols = parseCsvLine(l)
    return { id: cols[idIdx], name: cols[nameIdx] ?? "" }
  })

  console.log(`Found ${candidates.length} delete candidates${dryRun ? " (DRY RUN)" : ""}`)

  // Check for FK references in workout_exercises
  const { data: weRefs } = await supabase
    .from("workout_exercises")
    .select("exercise_id")
    .in("exercise_id", candidates.map((c) => c.id))

  const referencedByWE = new Set((weRefs ?? []).map((r) => r.exercise_id))

  // Check for FK references in set_logs
  const { data: slRefs } = await supabase
    .from("set_logs")
    .select("exercise_id")
    .in("exercise_id", candidates.map((c) => c.id))

  const referencedBySL = new Set((slRefs ?? []).map((r) => r.exercise_id))

  const safe: typeof candidates = []
  const blocked: { id: string; name: string; reason: string }[] = []

  for (const c of candidates) {
    const refs: string[] = []
    if (referencedByWE.has(c.id)) refs.push("workout_exercises")
    if (referencedBySL.has(c.id)) refs.push("set_logs")
    if (refs.length > 0) {
      blocked.push({ ...c, reason: `referenced in ${refs.join(" + ")}` })
    } else {
      safe.push(c)
    }
  }

  if (blocked.length > 0) {
    console.log(`\n⚠ ${blocked.length} exercise(s) SKIPPED (in use):`)
    for (const b of blocked) {
      console.log(`  - ${b.name} (${b.id}) — ${b.reason}`)
    }
  }

  if (safe.length === 0) {
    console.log("\nNothing to delete.")
    return
  }

  console.log(`\n${safe.length} exercise(s) to delete:`)
  for (const s of safe) {
    console.log(`  - ${s.name} (${s.id})`)
  }

  if (dryRun) {
    console.log("\nDry run — no changes made.")
    return
  }

  const { error, count } = await supabase
    .from("exercises")
    .delete({ count: "exact" })
    .in("id", safe.map((s) => s.id))

  if (error) {
    console.error("\nDelete failed:", error.message)
    process.exit(1)
  }

  console.log(`\nDeleted ${count} exercise(s) from the database.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
