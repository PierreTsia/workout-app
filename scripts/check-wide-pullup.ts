import "./load-env.js"
import { createClient } from "@supabase/supabase-js"

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const dupId = "221713db-03c5-4db0-835e-80ed109a872a"
  const keepId = "51425997-110e-4584-a43f-86a43866d81d"

  const { data: exercises } = await s
    .from("exercises")
    .select("id, name, name_en, muscle_group, equipment")
    .in("id", [dupId, keepId])

  console.log("=== Both exercises ===")
  for (const e of exercises ?? []) console.log(JSON.stringify(e, null, 2))

  const { data: we } = await s.from("workout_exercises").select("id").eq("exercise_id", dupId)
  const { data: sl } = await s.from("set_logs").select("id").eq("exercise_id", dupId)
  console.log(`\nFK refs for "Wide pull up" (${dupId}):`)
  console.log(`  workout_exercises: ${we?.length ?? 0}`)
  console.log(`  set_logs: ${sl?.length ?? 0}`)
}

main()
