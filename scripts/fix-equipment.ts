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
  const inputPath = path.join(root, "equipment_fixes.csv")

  if (!fs.existsSync(inputPath)) {
    console.error("File not found:", inputPath)
    process.exit(1)
  }

  const lines = fs.readFileSync(inputPath, "utf-8").split(/\r?\n/).filter(Boolean)
  const headers = parseCsvLine(lines[0])

  const idIdx = headers.indexOf("id")
  const nameIdx = headers.indexOf("name")
  const currentIdx = headers.indexOf("current_equipment")
  const suggestedIdx = headers.indexOf("suggested_equipment")

  if (idIdx < 0 || suggestedIdx < 0) {
    console.error("CSV must have 'id' and 'suggested_equipment' columns")
    process.exit(1)
  }

  const fixes = lines.slice(1).filter((l) => l.trim()).map((l) => {
    const cols = parseCsvLine(l)
    return {
      id: cols[idIdx],
      name: cols[nameIdx] ?? "",
      current: cols[currentIdx] ?? "",
      suggested: cols[suggestedIdx],
    }
  })

  console.log(`Found ${fixes.length} equipment fixes${dryRun ? " (DRY RUN)" : ""}\n`)

  let success = 0
  let failed = 0

  for (const fix of fixes) {
    const label = `${fix.name}: ${fix.current} → ${fix.suggested}`

    if (dryRun) {
      console.log(`  [dry] ${label}`)
      success++
      continue
    }

    const { error } = await supabase
      .from("exercises")
      .update({ equipment: fix.suggested })
      .eq("id", fix.id)

    if (error) {
      console.error(`  [FAIL] ${label} — ${error.message}`)
      failed++
    } else {
      console.log(`  [OK] ${label}`)
      success++
    }
  }

  console.log(`\nDone: ${success} updated, ${failed} failed.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
