/**
 * Score-gap ambiguity helper for `resolve_exercises`.
 *
 * Pure functions, no env access — the handler boundary in
 * `tools/resolveExercises.ts` reads `Deno.env` once and passes the parsed
 * gap through `resolveAmbiguityGap`, mirroring the `lib/pat.ts`
 * "no-Deno-in-lib" convention so tests don't need to fake `Deno.env`.
 */

export const DEFAULT_AMBIGUITY_GAP = 0.1

export function isAmbiguous(
  matches: { score: number }[],
  gap: number = DEFAULT_AMBIGUITY_GAP,
): boolean {
  if (matches.length < 2) return false
  return matches[0].score - matches[1].score < gap
}

/**
 * Parse the raw `MCP_AMBIGUITY_GAP` env value into a usable threshold.
 *
 * The handler boundary (`tools/resolveExercises.ts`) is the only place that
 * touches `Deno.env`; this stays pure to keep the lib trivially testable.
 *
 * Falls back to `DEFAULT_AMBIGUITY_GAP` for: unset, empty, non-numeric, or
 * out-of-range `(0, 1]`. Permissive on whitespace.
 *
 * TUNING: production traces should distinguish "false-ambiguous rate"
 * (status=ambiguous on names that turned out to have one obvious match) from
 * "false-confident rate" (status=matched on names where the agent had to
 * retry / asked the user). Lower the env to widen the ambiguous net,
 * raise it to silence false-ambiguous flags. Default 0.10 is a starter bet
 * informed only by the existing pg_trgm similarity floor (0.15) used by
 * search_exercises.
 */
export function resolveAmbiguityGap(
  envValue: string | null | undefined,
): number {
  if (envValue == null) return DEFAULT_AMBIGUITY_GAP
  const parsed = parseFloat(envValue)
  if (!Number.isFinite(parsed)) return DEFAULT_AMBIGUITY_GAP
  if (parsed <= 0 || parsed > 1) return DEFAULT_AMBIGUITY_GAP
  return parsed
}
