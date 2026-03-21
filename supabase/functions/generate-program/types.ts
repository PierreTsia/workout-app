export interface ProgramDay {
  label: string
  muscle_focus: string
  exercise_ids: string[]
}

export interface GenerateProgramResponse {
  rationale: string
  days: ProgramDay[]
}
