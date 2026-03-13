import "./load-env.js"
import { createClient } from "@supabase/supabase-js"

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const id = "221713db-03c5-4db0-835e-80ed109a872a"
  const { error } = await s.from("exercises").delete().eq("id", id)
  if (error) {
    console.error("FAIL:", error.message)
    process.exit(1)
  }
  console.log(`Deleted "Wide pull up" (${id})`)
}

main()
