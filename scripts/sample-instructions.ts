import "./load-env.js"
import { createClient } from "@supabase/supabase-js"

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data } = await s
    .from("exercises")
    .select("id, name, name_en, instructions, equipment, muscle_group")
    .order("name")

  let nullCount = 0
  let emptyCount = 0
  let withInstructions = 0
  const formats: Record<string, number> = {}
  const langs: Record<string, number> = {}
  const lengths: number[] = []

  for (const r of data ?? []) {
    if (r.instructions == null) { nullCount++; continue }
    if (typeof r.instructions === "object" && Object.keys(r.instructions).length === 0) { emptyCount++; continue }

    withInstructions++
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instr = r.instructions as any

    if (typeof instr === "string") {
      formats["string"] = (formats["string"] ?? 0) + 1
    } else if (Array.isArray(instr)) {
      formats["array"] = (formats["array"] ?? 0) + 1
    } else if (typeof instr === "object") {
      const keys = Object.keys(instr).sort().join(",")
      formats[keys] = (formats[keys] ?? 0) + 1
      if (instr.fr) langs["has_fr"] = (langs["has_fr"] ?? 0) + 1
      if (instr.en) langs["has_en"] = (langs["has_en"] ?? 0) + 1
      const frLen = typeof instr.fr === "string" ? instr.fr.length : Array.isArray(instr.fr) ? JSON.stringify(instr.fr).length : 0
      if (frLen > 0) lengths.push(frLen)
    }
  }

  console.log(`Total: ${data?.length}`)
  console.log(`Null instructions: ${nullCount}`)
  console.log(`Empty instructions: ${emptyCount}`)
  console.log(`With instructions: ${withInstructions}`)
  console.log(`\nFormats:`, formats)
  console.log(`Languages:`, langs)
  console.log(`FR instruction lengths: min=${Math.min(...lengths)}, max=${Math.max(...lengths)}, avg=${Math.round(lengths.reduce((a,b)=>a+b,0)/lengths.length)}`)

  // Print 5 samples
  console.log("\n=== SAMPLES ===")
  let shown = 0
  for (const r of data ?? []) {
    if (r.instructions != null && typeof r.instructions === "object" && Object.keys(r.instructions).length > 0) {
      console.log(`\n--- ${r.name} (${r.equipment}) ---`)
      console.log(JSON.stringify(r.instructions, null, 2))
      if (++shown >= 5) break
    }
  }
}

main()
