export type RemovedDay = {
  id: string
  label: string
  session_count: number
  blocking: boolean
}

export type AddedDay = { label: string }

export type ProgramPatchStatus = 'preview' | 'applied'

/** The `structuredContent` an `update_program` result carries into the view (ADR 0028). */
export type ProgramPatchPayload = {
  status: ProgramPatchStatus
  dry_run?: boolean
  program_id?: string
  rendered?: string
  removed_days?: RemovedDay[]
  added_days?: AddedDay[]
  warnings?: string[]
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
  removedOne: string
  removedOther: string
  addedOne: string
  addedOther: string
}
