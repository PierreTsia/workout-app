/**
 * Compact a per-round numeric sequence for display (#351): uniform rounds
 * collapse to a single value, pyramidal rounds join with "·" (e.g. "10·12·8").
 */
export function compactNumberSequence(values: number[]): string {
  if (values.length === 0) return ""
  const allEqual = values.every((v) => v === values[0])
  return allEqual ? String(values[0]) : values.join("·")
}
