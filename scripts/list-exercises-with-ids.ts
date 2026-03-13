import "./load-env.js"
import { createClient } from "@supabase/supabase-js"

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data } = await s
    .from("exercises")
    .select("id, name, name_en, muscle_group")
    .order("muscle_group")
    .order("name")

  for (const r of data ?? []) {
    console.log(`${r.id}\t${r.muscle_group}\t${r.name}\t${r.name_en ?? ""}`)
  }
}

main()
