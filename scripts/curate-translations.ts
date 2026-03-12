import { createClient } from "@supabase/supabase-js"
import { OVERRIDES, normalizeCasing } from "./fitness-dictionary.js"
import * as fs from "node:fs"
import * as path from "node:path"

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const DRY_RUN = !process.argv.includes("--apply")

const NON_ENGLISH_PATTERNS = [
  /[\u0400-\u04FF]/,
  /\b(con agarre|de pie|sentado|polea alta|polea baja|pecho neutro|en banco|mancuerna|al pecho|cerrado supino|abierto supino|traseras?|burro con|gluteo|en maquina|de gluteos|jal[oó]n|caballero|patada|respiraci[oó]n|profunda)\b/i,
  /\b(impugnatura|trazioni|isometria|femorale|alle parallele)\b/i,
  /\bKopf[üu]ber\b/i,
  /\bRemada?\b.*\bcabo\b/i,
  /^Remo alto/i,
  /^PULL OVER POLEA/i,
  /^Elevaci[oó]n/i,
  /^Extensi[oó]n de glute/i,
  /^Kreis Press/i,
  /^Curl de biceps con/i,
]

function isNonEnglish(name: string): boolean {
  return NON_ENGLISH_PATTERNS.some((re) => re.test(name))
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN (add --apply to update DB) ===" : "=== APPLYING CHANGES ===")
  console.log()

  const { data: exercises, error } = await supabase
    .from("exercises")
    .select("id, name, name_en, is_system")
    .order("name_en")

  if (error || !exercises) {
    console.error("Failed to fetch exercises:", error?.message)
    process.exit(1)
  }

  // --- Phase 1: Delete non-English exercises ---
  const toDelete = exercises.filter(
    (ex) => !ex.is_system && ex.name_en && isNonEnglish(ex.name_en.trim()),
  )

  console.log(`Non-English exercises to delete: ${toDelete.length}`)
  for (const ex of toDelete) {
    console.log(`  ✕ ${ex.name_en}`)
  }

  const deleteIds = new Set(toDelete.map((ex) => ex.id))

  // --- Phase 2: Curate translations on remaining exercises ---
  const changes: { id: string; name_en: string; old_name: string; new_name: string; reason: string }[] = []

  for (const ex of exercises) {
    if (ex.is_system || deleteIds.has(ex.id)) continue

    const nameEn = ex.name_en?.trim() ?? ""
    if (!nameEn) continue

    let newName: string | null = null
    let reason = ""

    const overrideKey = Object.keys(OVERRIDES).find(
      (k) => k.toLowerCase() === nameEn.toLowerCase(),
    )
    if (overrideKey) {
      newName = OVERRIDES[overrideKey]
      reason = "override"
    }

    if (!newName) {
      const caseFix = normalizeCasing(ex.name)
      if (caseFix !== ex.name) {
        newName = caseFix
        reason = "casing"
      }
    }

    if (newName && newName !== ex.name) {
      changes.push({
        id: ex.id,
        name_en: nameEn,
        old_name: ex.name,
        new_name: newName,
        reason,
      })
    }
  }

  console.log(`\nTotal exercises: ${exercises.length}`)
  console.log(`System (skipped): ${exercises.filter((e) => e.is_system).length}`)
  console.log(`To delete (foreign): ${toDelete.length}`)
  console.log(`Translation fixes: ${changes.length}`)
  console.log()

  const outputDir = path.join(import.meta.dirname, "output")
  fs.mkdirSync(outputDir, { recursive: true })
  const csvPath = path.join(outputDir, "curation-diff.csv")
  const header = "name_en,old_name_fr,new_name_fr,reason\n"
  const rows = changes
    .map(
      (c) =>
        `"${c.name_en.replace(/"/g, '""')}","${c.old_name.replace(/"/g, '""')}","${c.new_name.replace(/"/g, '""')}",${c.reason}`,
    )
    .join("\n")
  fs.writeFileSync(csvPath, header + rows, "utf-8")
  console.log(`Diff CSV: ${csvPath}`)

  console.log("\n--- Preview (first 20 fixes) ---")
  for (const c of changes.slice(0, 20)) {
    console.log(`  ${c.name_en}`)
    console.log(`    ${c.old_name} → ${c.new_name} [${c.reason}]`)
  }
  if (changes.length > 20) console.log(`  ... and ${changes.length - 20} more`)

  if (!DRY_RUN) {
    // Delete foreign exercises
    if (toDelete.length > 0) {
      console.log("\n--- Deleting non-English exercises ---")
      const ids = toDelete.map((e) => e.id)
      const { error: delError, count } = await supabase
        .from("exercises")
        .delete({ count: "exact" })
        .in("id", ids)

      if (delError) {
        console.error(`Delete failed: ${delError.message}`)
      } else {
        console.log(`Deleted: ${count}`)
      }
    }

    // Apply translation fixes
    if (changes.length > 0) {
      console.log("\n--- Applying translation fixes ---")
      let applied = 0
      let failed = 0

      for (const c of changes) {
        const { error: updateError } = await supabase
          .from("exercises")
          .update({ name: c.new_name })
          .eq("id", c.id)

        if (updateError) {
          console.error(`  Failed: ${c.name_en} — ${updateError.message}`)
          failed++
        } else {
          applied++
        }
      }

      console.log(`Applied: ${applied}, Failed: ${failed}`)
    }
  }
}

main().catch((err) => {
  console.error("Curation failed:", err)
  process.exit(1)
})
