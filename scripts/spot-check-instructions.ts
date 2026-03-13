import "./load-env.js"
import { createClient } from "@supabase/supabase-js"

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const SPOT_CHECK_IDS = [
  "a734caec-afb3-4c27-b1b7-62e038a7d3d3",  // Adduction de Copenhague (was factually wrong before)
  "7eefe1b3-b826-422b-95ee-400ee2e9b14b",  // Abduction hanches supination (mentioned dumbbell before)
  "dbfb1939-bdcb-4d25-873c-f4f03c6b44f2",  // Développé couché (bench press — core exercise)
  "f0ed460c-9eea-4146-83fa-4b8584adc9e6",  // Soulevé de terre (deadlift)
  "7bf594f1-283a-4647-a6d4-2e0ed57935aa",  // Tirage poulie haute (lat pulldown — was bodyweight)
  "e63fe427-e910-4e0d-9f73-c51d85b36a3f",  // Pompes (push-ups — bodyweight)
  "50bd1988-2cd5-4c59-a636-07d15b6ffff0",  // Swing kettlebell
  "8847dd79-7f44-42e8-8daa-18fca1a91273",  // Face pull (cable)
]

async function main() {
  for (const id of SPOT_CHECK_IDS) {
    const { data } = await s.from("exercises").select("name, name_en, equipment, muscle_group, instructions").eq("id", id).single()
    if (!data) continue
    console.log(`\n${"=".repeat(60)}`)
    console.log(`${data.name} (${data.name_en}) — ${data.equipment} — ${data.muscle_group}`)
    console.log("=".repeat(60))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instr = data.instructions as any
    for (const section of ["setup", "movement", "breathing", "common_mistakes"]) {
      console.log(`\n  [${section}]`)
      for (const line of instr[section] ?? []) console.log(`    • ${line}`)
    }
  }
}

main()
