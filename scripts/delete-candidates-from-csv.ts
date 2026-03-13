/**
 * Parse the exercises CSV export and output delete_candidates.csv with rows that can
 * likely be safely deleted.
 *
 * Criteria:
 * - name or name_en contains "test"
 * - Exact duplicate: same normalized name + muscle_group (keep first, flag rest)
 * - Too close: same muscle_group and one name is contained in the other (flag shorter)
 * - Obscure-looking: very short name, placeholder-like (no Google check; manual review)
 *
 * Usage:
 *   npx tsx scripts/delete-candidates-from-csv.ts [--input=exercises-export-*.csv] [--out=delete_candidates.csv]
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

// ---------- CSV parse (handles quoted fields with commas and escaped quotes) ----------

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if ((c === "," && !inQuotes) || (c === "\n" && !inQuotes)) {
      out.push(cur)
      cur = ""
      if (c === "\n") break
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseCsvLine(lines[0])
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, j) => {
      row[h] = values[j] ?? ""
    })
    rows.push(row)
  }
  return { headers, rows }
}

// ---------- Candidate detection ----------

type Reason =
  | { kind: "contains_test" }
  | { kind: "duplicate_name"; of?: string }
  | { kind: "similar_to"; otherName: string; otherId: string }
  | { kind: "obscure_name" }

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function containsTest(name: string): boolean {
  return /\btest\b/i.test(name)
}

function looksObscure(name: string, nameEn: string): boolean {
  const n = name.trim()
  const e = (nameEn ?? "").trim()
  if (n.length <= 2) return true
  if (/^(xxx|todo|tbd|n\/a|na|none|unknown)$/i.test(n) || /^(xxx|todo|tbd|n\/a|na|none|unknown)$/i.test(e))
    return true
  if (/^\d+$/.test(n)) return true
  return false
}

function escapeCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

async function main() {
  const inputArg = process.argv.find((a) => a.startsWith("--input="))
  const outArg = process.argv.find((a) => a.startsWith("--out="))

  const inputPath = inputArg
    ? path.resolve(process.cwd(), inputArg.slice("--input=".length))
    : (() => {
        const dir = fs.readdirSync(root)
        const exports = dir
          .filter((f) => f.startsWith("exercises-export-") && f.endsWith(".csv"))
          .sort()
          .reverse()
        if (exports.length === 0) {
          console.error("No exercises-export-*.csv found. Run export-exercises-csv.ts first or pass --input=path")
          process.exit(1)
        }
        return path.join(root, exports[0])
      })()

  const outPath = outArg
    ? path.resolve(process.cwd(), outArg.slice("--out=".length))
    : path.join(root, "delete_candidates.csv")

  if (!fs.existsSync(inputPath)) {
    console.error("Input file not found:", inputPath)
    process.exit(1)
  }

  const content = fs.readFileSync(inputPath, "utf-8")
  const { headers, rows } = parseCsv(content)

  const idIdx = headers.indexOf("id")
  const nameIdx = headers.indexOf("name")
   

  const muscleIdx = headers.indexOf("muscle_group")

  if (idIdx < 0 || nameIdx < 0 || muscleIdx < 0) {
    console.error("CSV must have columns: id, name, muscle_group (and optionally name_en)")
    process.exit(1)
  }

  const exercises = rows.map((r) => ({
    id: r.id ?? "",
    name: (r.name ?? "").trim(),
    name_en: (r.name_en ?? "").trim(),
    muscle_group: (r.muscle_group ?? "").trim(),
  }))

  const reasons = new Map<string, Reason>()

  for (const ex of exercises) {
    if (containsTest(ex.name) || containsTest(ex.name_en)) {
      reasons.set(ex.id, { kind: "contains_test" })
      continue
    }
    if (looksObscure(ex.name, ex.name_en)) {
      reasons.set(ex.id, { kind: "obscure_name" })
    }
  }

  const byKey = new Map<string, { id: string; name: string }[]>()
  for (const ex of exercises) {
    const key = `${normalize(ex.name)}|${ex.muscle_group}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push({ id: ex.id, name: ex.name })
  }

  for (const [, group] of byKey) {
    if (group.length <= 1) continue
    const [first, ...rest] = group
    for (const r of rest) {
      reasons.set(r.id, { kind: "duplicate_name", of: first.name })
    }
  }

  const byMuscle = new Map<string, typeof exercises>()
  for (const ex of exercises) {
    const mg = ex.muscle_group
    if (!byMuscle.has(mg)) byMuscle.set(mg, [])
    byMuscle.get(mg)!.push(ex)
  }

  for (const [, group] of byMuscle) {
    for (let i = 0; i < group.length; i++) {
      const a = group[i]
      if (reasons.has(a.id)) continue
      const na = normalize(a.name)
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue
        const b = group[j]
        const nb = normalize(b.name)
        if (na !== nb && (na.includes(nb) || nb.includes(na))) {
          const shorter = na.length <= nb.length ? a : b
          const longer = na.length <= nb.length ? b : a
          if (!reasons.has(shorter.id)) {
            reasons.set(shorter.id, { kind: "similar_to", otherName: longer.name, otherId: longer.id })
          }
          break
        }
      }
    }
  }

  const candidateRows: { id: string; name: string; reason: string }[] = []
  for (const ex of exercises) {
    const r = reasons.get(ex.id)
    if (!r) continue
    let reasonText: string
    switch (r.kind) {
      case "contains_test":
        reasonText = "name contains 'test'"
        break
      case "duplicate_name":
        reasonText = r.of ? `duplicate of "${r.of}"` : "duplicate name"
        break
      case "similar_to":
        reasonText = `similar to "${r.otherName}" (id ${r.otherId})`
        break
      case "obscure_name":
        reasonText = "obscure/placeholder name (manual review)"
        break
    }
    candidateRows.push({ id: ex.id, name: ex.name, reason: reasonText })
  }

  const outHeaders = ["id", "name", "reason"]
  const outLines = [outHeaders.join(",")]
  for (const row of candidateRows) {
    outLines.push([escapeCsv(row.id), escapeCsv(row.name), escapeCsv(row.reason)].join(","))
  }

  fs.writeFileSync(outPath, outLines.join("\n"), "utf-8")
  console.log(`Wrote ${candidateRows.length} delete candidates to ${outPath}`)
  if (candidateRows.length > 0) {
    const byReason = new Map<string, number>()
    for (const r of candidateRows) {
      const key = r.reason.replace(/\(id [a-f0-9-]+\)/, "(id ...)")
      byReason.set(key, (byReason.get(key) ?? 0) + 1)
    }
    console.log("By reason:")
    for (const [reason, count] of byReason) {
      console.log(`  ${count}x ${reason}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
