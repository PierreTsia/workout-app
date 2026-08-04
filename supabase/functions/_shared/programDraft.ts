// Shared program draft logic — the single home for program-drafting plumbing,
// called by the `embedded-agent` Edge function via `runProgramDraftStep`.
// Originally extracted from the `generate-program/` function (now deleted) to
// avoid cross-Edge imports.
//
// This module is intentionally pure TS — no `Deno.*` globals — so it can be
// imported from vitest specs in `src/test/`. The Gemini HTTP call lives in the
// sibling `programGemini.ts` (Deno-only).
//
// Public surface:
//   Types:    CatalogExercise, UserProfile, RecentExercise, ProgramConstraints,
//             CatalogEntry, ValidatedDay, ValidateProgramResult, ProgramDay,
//             GenerateProgramResponse
//   Helpers:  getEquipmentValues, getExerciseBounds, capCatalog,
//             buildProgramPrompt, validateProgram

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogExercise {
  id: string
  name_en: string | null
  muscle_group: string
  equipment: string
  secondary_muscles: string[] | null
  difficulty_level: string | null
}

export interface UserProfile {
  experience: string
  goal: string
  equipment: string
  training_days_per_week: number
  age: number | null
  gender: string | null
}

export interface RecentExercise {
  exercise_id: string
  exercise_name_snapshot: string
}

export interface ProgramConstraints {
  daysPerWeek: number
  duration: number
  equipmentCategory: string
  goal: string
  experience: string
  focusAreas?: string
  splitPreference?: string
  locale?: string
}

/** Nested Circuit exercise on the LLM draft wire (maps 1:1 to MCP Circuit Item). */
export type DraftCircuitExercise =
  | { exercise_id: string; amount: number; weight_kg: number }
  | {
      exercise_id: string
      per_round: { amount: number; weight_kg: number }[]
    }

export interface DraftCircuitItem {
  type: "circuit"
  label?: string
  rounds?: number
  rest_seconds?: number
  transition_seconds?: number
  exercises: DraftCircuitExercise[]
}

/** Day item: bare catalog UUID or a Circuit (T168 / ADR 0011). */
export type DraftDayItem = string | DraftCircuitItem

export interface ProgramDay {
  label: string
  muscle_focus: string
  /** Preferred mixed list (solos + Circuits). */
  exercises?: DraftDayItem[]
  /** Legacy flat UUID list — still accepted; normalized to `exercises`. */
  exercise_ids?: string[]
}

export interface GenerateProgramResponse {
  rationale: string
  days: ProgramDay[]
}

export interface CatalogEntry {
  id: string
  muscle_group: string
}

export interface ValidatedDay {
  label: string
  muscle_focus: string
  /** Cleaned day sequence (solos + Circuits). */
  exercises: DraftDayItem[]
  /**
   * Solo UUIDs only (for back-compat with consumers that still read this).
   * Does not include nested Circuit exercise_ids.
   */
  exercise_ids: string[]
  dropped: number
  backfilled: number
}

export interface ValidateProgramResult {
  rationale: string
  days: ValidatedDay[]
  repaired: boolean
  totalDropped: number
  totalBackfilled: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt building
// ─────────────────────────────────────────────────────────────────────────────

const EQUIPMENT_CATEGORY_MAP: Record<string, string[]> = {
  bodyweight: ["bodyweight"],
  dumbbells: ["dumbbell"],
  "full-gym": [
    "barbell", "dumbbell", "ez_bar", "machine", "cable", "bench", "kettlebell", "band",
  ],
}

const MAX_CATALOG_SIZE = 120
const MAX_PER_GROUP = 15

const VOLUME_MAP: Record<number, number> = {
  15: 4, 30: 5, 45: 7, 60: 9, 90: 13,
}

export function getEquipmentValues(category: string): string[] {
  return EQUIPMENT_CATEGORY_MAP[category] ?? []
}

export function getExerciseBounds(duration: number): { min: number; max: number } {
  const base = VOLUME_MAP[duration] ?? 7
  return { min: Math.max(4, base - 2), max: Math.min(13, base + 2) }
}

export function capCatalog(exercises: CatalogExercise[]): CatalogExercise[] {
  if (exercises.length <= MAX_CATALOG_SIZE) return exercises

  const byGroup = new Map<string, CatalogExercise[]>()
  for (const ex of exercises) {
    const list = byGroup.get(ex.muscle_group) ?? []
    list.push(ex)
    byGroup.set(ex.muscle_group, list)
  }

  const capped: CatalogExercise[] = []
  for (const [, groupExercises] of byGroup) {
    const shuffled = groupExercises.sort(() => Math.random() - 0.5)
    capped.push(...shuffled.slice(0, MAX_PER_GROUP))
  }
  return capped
}

function serializeCatalog(exercises: CatalogExercise[]): string {
  return JSON.stringify(
    exercises.map((e) => ({
      id: e.id,
      n: e.name_en ?? e.muscle_group,
      mg: e.muscle_group,
      eq: e.equipment,
      sm: e.secondary_muscles ?? [],
      dl: e.difficulty_level ?? "unknown",
    })),
  )
}

export function buildProgramPrompt(
  catalog: CatalogExercise[],
  profile: UserProfile | null,
  recentExercises: RecentExercise[],
  constraints: ProgramConstraints,
  trainingGap: boolean,
): string {
  const bounds = getExerciseBounds(constraints.duration)
  const lines: string[] = []

  lines.push(
    "You are a strength and conditioning coach designing a multi-day training program.",
    "",
    "RULES:",
    `- Design a training split for ${constraints.daysPerWeek} days per week.`,
    `- Each day should have between ${bounds.min} and ${bounds.max} exercises.`,
    "- Return ONLY exercise IDs from the EXERCISE CATALOG below. Never invent IDs.",
    "- Each day `exercises` array mixes bare UUID strings (solos) and optional Circuit objects `{ type: \"circuit\", exercises: [{ exercise_id, amount, weight_kg }, ...] }`. A Circuit counts as ONE slot toward the per-day min/max.",
    "- Nested Circuit exercises use amount + weight_kg (not solo sets/reps). Same exercise_id may appear twice inside one Circuit (complexes); do not duplicate a solo UUID across days.",
    "- Circuit prescriptions are frozen (no auto progression on nested amount/weight). Prefer Circuits for finishers, supersets, conditioning complexes — not every pairing.",
    "- Order solos within each day: compound movements (those with secondary_muscles) first, isolation last. Place Circuits after the main strength work when used as finishers.",
    "- Group synergistic muscles on the same day (e.g. chest + triceps, back + biceps).",
    "- Distribute muscle groups across the week so no group is overtrained.",
    "- Provide a brief rationale (1-2 sentences) explaining why this split suits the user.",
    `- Given the user's experience level (${constraints.experience}), prefer exercises whose difficulty_level matches or is one step above.`,
  )

  if (constraints.locale && constraints.locale !== "en") {
    lines.push(`- Write the rationale and day labels in ${constraints.locale === "fr" ? "French" : constraints.locale}. Exercise IDs stay unchanged.`)
  }

  if (constraints.splitPreference && constraints.splitPreference !== "auto") {
    lines.push(`- The user prefers a ${constraints.splitPreference} split.`)
  }
  if (constraints.focusAreas) {
    lines.push(`- The user wants to emphasize: ${constraints.focusAreas}.`)
  }
  if (trainingGap) {
    lines.push(
      "- The user hasn't trained in over 2 weeks. Propose a conservative re-entry program: prefer compound movements, standard volume, moderate intensity.",
    )
  }

  lines.push(
    "",
    "USER PROFILE:",
    `- Experience: ${constraints.experience}`,
    `- Goal: ${constraints.goal}`,
    `- Equipment: ${constraints.equipmentCategory}`,
    `- Session duration: ${constraints.duration} minutes`,
  )

  if (profile?.age != null) lines.push(`- Age: ${profile.age}`)
  if (profile?.gender && profile.gender !== "prefer_not_to_say") {
    lines.push(`- Gender: ${profile.gender}`)
  }

  if (recentExercises.length > 0) {
    lines.push("", "RECENT EXERCISES (prefer variety over these):")
    for (const ex of recentExercises) {
      lines.push(`- ${ex.exercise_id} (${ex.exercise_name_snapshot})`)
    }
  }

  lines.push("", "EXERCISE CATALOG:", serializeCatalog(catalog))

  return lines.join("\n")
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation + repair
// ─────────────────────────────────────────────────────────────────────────────

function normalizeDayItems(day: ProgramDay): DraftDayItem[] {
  if (Array.isArray(day.exercises) && day.exercises.length > 0) {
    return day.exercises
  }
  return day.exercise_ids ?? []
}

function releaseItemToPool(
  item: DraftDayItem,
  catalogMap: Map<string, CatalogEntry>,
  unusedByGroup: Map<string, string[]>,
  globalSeen: Set<string>,
) {
  const ids = typeof item === "string"
    ? [item]
    : item.exercises.map((e) => e.exercise_id)
  for (const id of [...new Set(ids)]) {
    globalSeen.delete(id)
    const entry = catalogMap.get(id)
    if (!entry) continue
    const list = unusedByGroup.get(entry.muscle_group) ?? []
    unusedByGroup.set(entry.muscle_group, [...list, id])
  }
}

export function validateProgram(
  llmOutput: GenerateProgramResponse,
  catalog: CatalogEntry[],
  targetDayCount: number,
  exerciseBounds: { min: number; max: number },
): ValidateProgramResult {
  const catalogMap = new Map<string, CatalogEntry>()
  for (const entry of catalog) catalogMap.set(entry.id, entry)

  let days = llmOutput.days ?? []

  if (days.length === 0) {
    return {
      rationale: llmOutput.rationale ?? "",
      days: [],
      repaired: false,
      totalDropped: 0,
      totalBackfilled: 0,
    }
  }

  if (days.length > targetDayCount) days = days.slice(0, targetDayCount)

  const globalSeen = new Set<string>()
  let totalDropped = 0
  let totalBackfilled = 0
  const validatedDays: ValidatedDay[] = []

  const unusedByGroup = new Map<string, string[]>()
  for (const entry of catalog) {
    const list = unusedByGroup.get(entry.muscle_group) ?? []
    list.push(entry.id)
    unusedByGroup.set(entry.muscle_group, list)
  }

  for (const day of days) {
    const items: DraftDayItem[] = []
    let dropped = 0

    for (const raw of normalizeDayItems(day)) {
      if (typeof raw === "string") {
        const id = raw
        if (globalSeen.has(id)) {
          dropped++
          continue
        }
        const entry = catalogMap.get(id)
        if (!entry) {
          dropped++
          continue
        }
        items.push(id)
        globalSeen.add(id)
        removeFromPool(unusedByGroup, entry.muscle_group, id)
        continue
      }

      if (!raw || raw.type !== "circuit" || !Array.isArray(raw.exercises)) {
        dropped++
        continue
      }

      const nested = raw.exercises
        .map((ex) => {
          if (!ex || typeof ex !== "object" || typeof ex.exercise_id !== "string") {
            return null
          }
          if (!catalogMap.has(ex.exercise_id)) return null
          return ex
        })
        .filter((ex): ex is DraftCircuitExercise => ex != null)

      // Same exercise_id twice inside a Circuit is allowed (complexes).
      if (nested.length < 2) {
        dropped++
        continue
      }

      const circuit: DraftCircuitItem = {
        type: "circuit",
        exercises: nested,
        ...(raw.label !== undefined ? { label: raw.label } : {}),
        ...(raw.rounds !== undefined ? { rounds: raw.rounds } : {}),
        ...(raw.rest_seconds !== undefined ? { rest_seconds: raw.rest_seconds } : {}),
        ...(raw.transition_seconds !== undefined
          ? { transition_seconds: raw.transition_seconds }
          : {}),
      }
      items.push(circuit)

      // Mark nested IDs as used so they aren't also placed as solos elsewhere,
      // but do NOT dedupe within this Circuit.
      for (const ex of nested) {
        if (globalSeen.has(ex.exercise_id)) continue
        globalSeen.add(ex.exercise_id)
        const entry = catalogMap.get(ex.exercise_id)
        if (entry) removeFromPool(unusedByGroup, entry.muscle_group, ex.exercise_id)
      }
    }

    let backfilled = 0
    while (items.length < exerciseBounds.min) {
      const picked = pickFromPool(unusedByGroup, day.muscle_focus, globalSeen)
      if (!picked) break
      items.push(picked)
      globalSeen.add(picked)
      backfilled++
    }

    if (items.length > exerciseBounds.max) {
      const excess = items.splice(exerciseBounds.max)
      for (const item of excess) {
        releaseItemToPool(item, catalogMap, unusedByGroup, globalSeen)
      }
    }

    totalDropped += dropped
    totalBackfilled += backfilled

    const soloIds = items.filter((i): i is string => typeof i === "string")

    validatedDays.push({
      label: day.label ?? `Day ${validatedDays.length + 1}`,
      muscle_focus: day.muscle_focus ?? "",
      exercises: items,
      exercise_ids: soloIds,
      dropped,
      backfilled,
    })
  }

  return {
    rationale: llmOutput.rationale ?? "",
    days: validatedDays,
    repaired: totalDropped > 0 || totalBackfilled > 0,
    totalDropped,
    totalBackfilled,
  }
}

function removeFromPool(pool: Map<string, string[]>, group: string, id: string) {
  const list = pool.get(group)
  if (!list) return
  const idx = list.indexOf(id)
  if (idx >= 0) list.splice(idx, 1)
  if (list.length === 0) pool.delete(group)
}

function pickFromPool(
  pool: Map<string, string[]>,
  preferredFocus: string,
  globalSeen: Set<string>,
): string | null {
  const focusGroups = preferredFocus.split(",").map((s) => s.trim())

  for (const group of focusGroups) {
    const list = pool.get(group)
    if (!list) continue
    for (let i = 0; i < list.length; i++) {
      if (!globalSeen.has(list[i])) {
        const [picked] = list.splice(i, 1)
        if (list.length === 0) pool.delete(group)
        return picked
      }
    }
  }

  for (const [group, list] of pool) {
    for (let i = 0; i < list.length; i++) {
      if (!globalSeen.has(list[i])) {
        const [picked] = list.splice(i, 1)
        if (list.length === 0) pool.delete(group)
        return picked
      }
    }
  }

  return null
}
