import "./load-env.js"
import { createClient } from "@supabase/supabase-js"

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data } = await s
    .from("exercises")
    .select("id, name, name_en, instructions, equipment, muscle_group")
    .order("name")

  const issues: { name: string; equipment: string; category: string; detail: string }[] = []

  const ENGLISH_WORDS = /\b(dumbbell|barbell|bench|cable|machine|weight|rep(?:etition)?s?|set[s]?|slowly|make sure|remember|don't)\b/i
  const REP_COUNTS = /\b\d+\s*(?:à|to)\s*\d+\s*(?:répétitions|reps|fois)\b/i

  for (const r of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instr = r.instructions as any
    if (!instr || typeof instr !== "object") continue

    const allText = [...(instr.setup ?? []), ...(instr.movement ?? []), ...(instr.breathing ?? []), ...(instr.common_mistakes ?? [])].join(" ")

    // Equipment mismatch: instructions mention wrong equipment
    if (r.equipment === "bodyweight" && /\b(haltère|dumbbell|barre|barbell)\b/i.test(allText)) {
      issues.push({ name: r.name, equipment: r.equipment, category: "EQUIP_MISMATCH", detail: "Bodyweight exercise mentions weights in instructions" })
    }
    if (r.equipment === "dumbbell" && /\b(barre(?! de traction)|barbell)\b/i.test(allText) && !/\bhaltère\b/i.test(allText)) {
      issues.push({ name: r.name, equipment: r.equipment, category: "EQUIP_MISMATCH", detail: "Dumbbell exercise mentions barbell but not dumbbell" })
    }
    if (r.equipment === "cable" && /\b(haltère|dumbbell|barre|barbell)\b/i.test(allText) && !/\b(poulie|câble|cable)\b/i.test(allText)) {
      issues.push({ name: r.name, equipment: r.equipment, category: "EQUIP_MISMATCH", detail: "Cable exercise doesn't mention cable/poulie" })
    }

    // English words in French text
    const englishMatches = allText.match(ENGLISH_WORDS)
    if (englishMatches) {
      issues.push({ name: r.name, equipment: r.equipment, category: "ENGLISH_IN_FR", detail: `English words: ${[...new Set(englishMatches)].join(", ")}` })
    }

    // Rep counts in instructions (should not prescribe reps)
    if (REP_COUNTS.test(allText)) {
      issues.push({ name: r.name, equipment: r.equipment, category: "REP_COUNT", detail: "Instructions prescribe rep counts" })
    }

    // Very short instructions (suspicious)
    const totalLen = allText.length
    if (totalLen < 100) {
      issues.push({ name: r.name, equipment: r.equipment, category: "TOO_SHORT", detail: `Only ${totalLen} chars total` })
    }

    // Empty sections
    for (const section of ["setup", "movement", "breathing", "common_mistakes"]) {
      if (!instr[section] || !Array.isArray(instr[section]) || instr[section].length === 0) {
        issues.push({ name: r.name, equipment: r.equipment, category: "EMPTY_SECTION", detail: `Empty ${section}` })
      }
    }

    // Movement section repeats "Répétez" (filler)
    const mvt = (instr.movement ?? []).join(" ")
    if (/\brépétez\b/i.test(mvt)) {
      issues.push({ name: r.name, equipment: r.equipment, category: "FILLER", detail: "Movement section contains 'Répétez' (filler)" })
    }
  }

  // Count by category
  const counts: Record<string, number> = {}
  for (const i of issues) counts[i.category] = (counts[i.category] ?? 0) + 1

  console.log("=== Issue counts ===")
  for (const [cat, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`)
  }
  console.log(`  TOTAL: ${issues.length}`)

  // Show samples per category
  const shown: Record<string, number> = {}
  console.log("\n=== Samples (3 per category) ===")
  for (const i of issues) {
    shown[i.category] = (shown[i.category] ?? 0) + 1
    if (shown[i.category] <= 3) {
      console.log(`\n[${i.category}] ${i.name} (${i.equipment})`)
      console.log(`  → ${i.detail}`)
    }
  }
}

main()
