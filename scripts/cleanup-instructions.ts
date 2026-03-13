import "./load-env.js"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const dryRun = process.argv.includes("--dry-run")

const REP_COUNT_RE = /\b\d+\s*(?:à|to)\s*\d+\s*(?:répétitions|reps|fois)\b/i
const REPETEZ_RE = /^répétez\b/i

const ENGLISH_REPLACEMENTS: [RegExp, string][] = [
  [/\bdumbbell(s)?\b/gi, "haltère$1"],
  [/\bbarbell\b/gi, "barre"],
  [/\bbench\b/gi, "banc"],
  [/\bweight(s)?\b/gi, "poids"],
  [/\bset(s)?\b/gi, "série$1"],
  [/\bslowly\b/gi, "lentement"],
  [/\bmake sure\b/gi, "assurez-vous"],
  [/\bremember\b/gi, "n'oubliez pas"],
  [/\bdon'?t\b/gi, "ne pas"],
  [/\brep(etition)?s?\b/gi, "répétition$1s"],
]

interface Instructions {
  setup: string[]
  movement: string[]
  breathing: string[]
  common_mistakes: string[]
}

function cleanSentence(s: string): string {
  let result = s
  for (const [re, replacement] of ENGLISH_REPLACEMENTS) {
    result = result.replace(re, replacement)
  }
  return result
}

function cleanSection(lines: string[], stripRepetez: boolean): { cleaned: string[]; changed: boolean } {
  let changed = false
  const out: string[] = []

  for (const line of lines) {
    if (REP_COUNT_RE.test(line)) { changed = true; continue }
    if (stripRepetez && REPETEZ_RE.test(line)) { changed = true; continue }

    const cleaned = cleanSentence(line)
    if (cleaned !== line) changed = true
    if (cleaned.trim()) out.push(cleaned)
  }

  return { cleaned: out, changed }
}

async function main() {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, instructions")
    .order("name")

  if (error) { console.error(error.message); process.exit(1) }

  let totalChanged = 0
  let totalStripped = 0


  for (const row of data ?? []) {
    const instr = row.instructions as Instructions
    if (!instr) continue

    const setupResult = cleanSection(instr.setup ?? [], false)
    const movementResult = cleanSection(instr.movement ?? [], true)
    const breathingResult = cleanSection(instr.breathing ?? [], false)
    const mistakesResult = cleanSection(instr.common_mistakes ?? [], false)

    const anyChanged = setupResult.changed || movementResult.changed || breathingResult.changed || mistakesResult.changed

    if (!anyChanged) continue
    totalChanged++

    const linesRemoved =
      (instr.setup?.length ?? 0) - setupResult.cleaned.length +
      (instr.movement?.length ?? 0) - movementResult.cleaned.length +
      (instr.breathing?.length ?? 0) - breathingResult.cleaned.length +
      (instr.common_mistakes?.length ?? 0) - mistakesResult.cleaned.length

    if (linesRemoved > 0) totalStripped += linesRemoved

    const newInstr: Instructions = {
      setup: setupResult.cleaned,
      movement: movementResult.cleaned,
      breathing: breathingResult.cleaned,
      common_mistakes: mistakesResult.cleaned,
    }

    if (dryRun) {
      console.log(`[dry] ${row.name} — ${linesRemoved} lines stripped`)
      continue
    }

    const { error: updateErr } = await supabase
      .from("exercises")
      .update({ instructions: newInstr })
      .eq("id", row.id)

    if (updateErr) {
      console.error(`[FAIL] ${row.name}: ${updateErr.message}`)
    } else {
      console.log(`[OK] ${row.name}`)
    }
  }

  console.log(`\nDone: ${totalChanged} exercises modified, ${totalStripped} lines stripped.`)
}

main().catch((err) => { console.error(err); process.exit(1) })
