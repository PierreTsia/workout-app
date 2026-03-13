import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data } = await s
    .from("exercises")
    .select("id, name, name_en, equipment")
    .order("equipment")
    .order("name")

  const equipmentSet = new Set<string>()
  const lines = ["id\tname_fr\tname_en\tequipment"]
  for (const r of data ?? []) {
    const eq = r.equipment ?? "(null)"
    equipmentSet.add(eq)
    lines.push(`${r.id}\t${r.name}\t${r.name_en ?? ""}\t${eq}`)
  }

  const outPath = path.join(root, "exercises-equipment.tsv")
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8")
  console.log(`Wrote ${(data?.length ?? 0)} exercises to ${outPath}`)
  console.log(`\nDistinct equipment values (${equipmentSet.size}):`)
  for (const eq of [...equipmentSet].sort()) console.log(`  - "${eq}"`)
}

main()
