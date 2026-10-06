export type RemovedDay = {
  id: string
  label: string
  session_count: number
  blocking: boolean
}

export type AddedDay = { label: string }

export type ProgramPatchStatus = 'preview' | 'applied'

export type PatchChangeField = 'sets' | 'reps' | 'weight' | 'rest'

export type PatchSoloExercise = {
  kind: 'solo'
  name: string
  sets: number
  reps: string
  weightKg: number
  restSeconds: number
  targetDurationSeconds: number | null
  isNew: boolean
  change: PatchChangeField[] | null
}

export type PatchCircuitExercise = {
  kind: 'circuit'
  label: string
  mode: 'rounds' | 'amrap'
  capSeconds: number | null
  rounds: number
  exerciseCount: number
  isNew: boolean
}

export type PatchExercise = PatchSoloExercise | PatchCircuitExercise

export type PatchDay = { label: string; emoji: string; exercises: PatchExercise[] }

/** The structured program carried in `structuredContent` (ADR 0031). */
export type PatchProgram = { name: string; days: PatchDay[] }

/** Typed `dry_run` warning, composed in the view's Display Locale (#677). */
export type PatchWarning =
  | { kind: 'active_cycle'; date: string }
  | { kind: 'slot_detachment'; exercise: string }

/** The `structuredContent` an `update_program` result carries into the view (ADR 0028/0031). */
export type ProgramPatchPayload = {
  status: ProgramPatchStatus
  dry_run?: boolean
  program_id?: string
  /** Markdown fallback; used only when `program` is absent. */
  rendered?: string
  removed_days?: RemovedDay[]
  added_days?: AddedDay[]
  /** French fallback strings for non-UI clients; the card prefers `warning_details`. */
  warnings?: string[]
  /** Locale-neutral warnings the card composes in the view's Display Locale. */
  warning_details?: PatchWarning[]
  /** ADR 0031/#677 — the explicit tool `locale`, ranked ABOVE the host language. */
  locale?: 'en' | 'fr'
  /** The `user_profiles.locale` seed, ranked BELOW the host language (Display Locale). */
  profile_locale?: 'en' | 'fr'
  program?: PatchProgram
  /** Present on a preview only; the view's Apply hands it back to `apply_program_patch`. */
  preview_token?: string
  /** Present after an apply. */
  message?: string
}

export type ProgramPatchViewState = 'preview' | 'applying' | 'applied' | 'error'

export type ProgramPatchLabels = {
  title: string
  apply: string
  applying: string
  applied: string
  error: string
  statusPreview: string
  consentNote: string
  removedOne: string
  removedOther: string
  addedOne: string
  addedOther: string
  changedSets: string
  changedReps: string
  changedWeight: string
  changedRest: string
  reps: string
  rest: string
  circuit: string
  amrapGloss: string
  roundsOne: string
  roundsOther: string
  circuitExercisesOne: string
  circuitExercisesOther: string
  /** Templates with `{{date}}` / `{{exercise}}`. */
  warnActiveCycle: string
  warnSlotDetachment: string
}
