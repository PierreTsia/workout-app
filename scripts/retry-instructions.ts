import "./load-env.js"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const GROQ_API_KEY = process.env.GROQ_API_KEY!
const MODEL = "llama-3.1-8b-instant"

const IDS = [
  "288b9b85-c912-40cf-9ba0-cd02f4d42efd",
  "203772ed-6ef8-4c87-88a6-3c917de11bec",
]

async function main() {
  for (const id of IDS) {
    const { data: ex } = await supabase.from("exercises").select("id, name, name_en, muscle_group, equipment").eq("id", id).single()
    if (!ex) { console.error(`Not found: ${id}`); continue }

    console.log(`Retrying: ${ex.name} (${ex.equipment})...`)

    const system = `Tu es un coach sportif expert et concis. Tu réponds uniquement en JSON valide, sans commentaires ni texte autour.
Règles: 2-3 phrases courtes par section. Correspond à l'équipement "${ex.equipment}". Pas de nombre de répétitions. Français, termes de salle en anglais (squat, curl, etc.).`
    const user = `Instructions JSON pour: ${ex.name}${ex.name_en ? ` (${ex.name_en})` : ""}, ${ex.muscle_group}, ${ex.equipment}. Clés: "setup", "movement", "breathing", "common_mistakes" (tableaux de chaînes).`

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 600, temperature: 0.5 }),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any
    const raw = data.choices?.[0]?.message?.content
    const match = raw?.match(/\{[\s\S]*\}/)
    if (!match) { console.error(`Invalid response for ${ex.name}:`, raw?.slice(0, 200)); continue }

    const parsed = JSON.parse(match[0])
    const { error } = await supabase.from("exercises").update({ instructions: parsed }).eq("id", id)
    console.log(error ? `FAIL: ${error.message}` : "OK")
  }
}

main()
