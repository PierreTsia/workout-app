/**
 * Display-time instruction resolution for MCP.
 *
 * Mirrors `resolveExerciseInstructions(..., "en")` in
 * `file:src/lib/catalogLabels.ts`. Kept local because the edge function cannot
 * import the Vite `@/` tree. If the app rule changes, update both.
 *
 * MCP tool chrome is English-only, so this always resolves as an English
 * reader — no profile / Accept-Language.
 */

export interface ExerciseInstructions {
  setup?: string[]
  movement?: string[]
  breathing?: string[]
  common_mistakes?: string[]
}

export interface InstructionSource {
  instructions?: ExerciseInstructions | null
  instructions_en?: ExerciseInstructions | null
  instructions_en_status?: string | null
}

const DISPLAYABLE_EN_STATUS: ReadonlySet<string> = new Set(["clean", "approved"])

const SECTIONS = [
  "setup",
  "movement",
  "breathing",
  "common_mistakes",
] as const satisfies readonly (keyof ExerciseInstructions)[]

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const filledSections = (
  block: ExerciseInstructions | null | undefined,
): ReadonlySet<keyof ExerciseInstructions> =>
  new Set(
    SECTIONS.filter((section) =>
      (block?.[section] ?? []).some((step) => clean(step)),
    ),
  )

/**
 * `instructions_en` (released status + section parity) → `instructions` → null.
 */
export function resolveEnglishInstructions(
  source: InstructionSource,
): ExerciseInstructions | null {
  const candidate = DISPLAYABLE_EN_STATUS.has(source.instructions_en_status ?? "")
    ? source.instructions_en
    : null

  const french = source.instructions ?? null
  const frenchSections = filledSections(french)
  const englishSections = filledSections(candidate)
  const hasParity = [...frenchSections].every((section) =>
    englishSections.has(section),
  )

  const resolved = candidate && hasParity ? candidate : french

  return filledSections(resolved).size > 0 ? resolved : null
}
