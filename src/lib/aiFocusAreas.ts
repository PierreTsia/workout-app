/** Keep in sync with `file:supabase/functions/_shared/aiFocusAreas.ts` */
export const AI_FOCUS_AREAS_MAX_LENGTH = 500

export function trimFocusAreas(s: string | undefined): string | undefined {
  if (s === undefined) return undefined
  const t = s.trim()
  return t.length === 0 ? undefined : t
}

export function isFocusAreasTooLong(s: string | undefined): boolean {
  if (s === undefined) return false
  return s.trim().length > AI_FOCUS_AREAS_MAX_LENGTH
}
