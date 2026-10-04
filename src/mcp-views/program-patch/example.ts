import type { ProgramPatchPayload } from './types'

/** Pre-rendered fallback shown until the host pushes a real result (ADR 0027). */
export const examplePayload: ProgramPatchPayload = {
  status: 'preview',
  dry_run: true,
  program_id: 'example',
  rendered: 'Push A\n  Bench Press — 4 × 10 × 60 kg total — 120s rest',
  removed_days: [],
  added_days: [{ label: 'Push B' }],
  warnings: [],
}
