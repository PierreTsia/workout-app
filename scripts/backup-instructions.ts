import "./load-env.js"
import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, instructions")
    .order("name")

  if (error) { console.error(error.message); process.exit(1) }

  const rows = data ?? []
  const out: Record<string, unknown>[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    instructions: r.instructions,
  }))

  const outPath = path.join(root, "instructions-backup.json")
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8")
  console.log(`Backed up ${rows.length} exercises to ${outPath}`)
}

main()
