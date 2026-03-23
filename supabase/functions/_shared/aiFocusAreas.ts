/** Keep in sync with `file:src/lib/aiFocusAreas.ts` */
export const AI_FOCUS_AREAS_MAX_LENGTH = 500

export function parseFocusAreasField(body: Record<string, unknown>): {
  focusAreas?: string
  error?: string
} {
  const raw = body.focusAreas
  if (raw === undefined || raw === null) return {}
  const s = String(raw).trim()
  if (s.length === 0) return {}
  if (s.length > AI_FOCUS_AREAS_MAX_LENGTH) {
    return {
      error: `focusAreas must be at most ${AI_FOCUS_AREAS_MAX_LENGTH} characters`,
    }
  }
  return { focusAreas: s }
}
