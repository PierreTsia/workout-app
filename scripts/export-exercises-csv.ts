/**
 * Export exercises table to a detailed CSV file.
 * Columns: name, name_en, muscle_group, instructions, equipment, secondary_muscles
 *
 * Run: npx tsx scripts/export-exercises-csv.ts
 * Output: exercises-export-<timestamp>.csv in project root (or use --out path)
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
  console.error("Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (e.g. from .env.local)")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const CSV_HEADERS = [
  "id",
  "name",
  "name_en",
  "muscle_group",
  "instructions",
  "equipment",
  "secondary_muscles",
] as const

function escapeCsvField(value: string | null | undefined): string {
  if (value == null) return ""
  const s = String(value)
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function formatInstructions(instructions: unknown): string {
  if (instructions == null) return ""
  if (typeof instructions !== "object") return String(instructions)
  try {
    return JSON.stringify(instructions)
  } catch {
    return String(instructions)
  }
}

function formatSecondaryMuscles(arr: string[] | null | undefined): string {
  if (arr == null || !Array.isArray(arr)) return ""
  return arr.join("; ")
}

async function main() {
  const outArg = process.argv.find((a) => a.startsWith("--out="))
  const outPath = outArg
    ? path.resolve(process.cwd(), outArg.slice("--out=".length))
    : path.join(root, `exercises-export-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.csv`)

  console.log("Fetching exercises from Supabase...")

  const { data: rows, error } = await supabase
    .from("exercises")
    .select("id, name, name_en, muscle_group, instructions, equipment, secondary_muscles")
    .order("name", { ascending: true })

  if (error) {
    console.error("Supabase error:", error.message)
    process.exit(1)
  }

  if (!rows?.length) {
    console.log("No exercises found.")
    fs.writeFileSync(outPath, CSV_HEADERS.join(",") + "\n", "utf-8")
    console.log("Wrote empty CSV to", outPath)
    return
  }

  const csvLines: string[] = [CSV_HEADERS.join(",")]

  for (const row of rows) {
    const cells = [
      escapeCsvField(row.id ?? ""),
      escapeCsvField(row.name ?? ""),
      escapeCsvField(row.name_en ?? ""),
      escapeCsvField(row.muscle_group ?? ""),
      escapeCsvField(formatInstructions(row.instructions)),
      escapeCsvField(row.equipment ?? ""),
      escapeCsvField(formatSecondaryMuscles(row.secondary_muscles)),
    ]
    csvLines.push(cells.join(","))
  }

  fs.writeFileSync(outPath, csvLines.join("\n"), "utf-8")
  console.log(`Exported ${rows.length} exercises to ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
