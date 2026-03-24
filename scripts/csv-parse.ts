/**
 * Quote-aware CSV line parser (commas inside quoted fields, escaped quotes).
 * Used by CLI scripts that ingest CSV exports.
 */

export function parseCsvLine(line: string): string[] {
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

export function parseCsv(content: string): {
  headers: string[]
  rows: Record<string, string>[]
} {
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
