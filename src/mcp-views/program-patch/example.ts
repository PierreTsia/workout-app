import type { ProgramPatchPayload } from './types'

/** Pre-rendered fallback shown until the host pushes a real result (ADR 0027/0031). */
export const examplePayload: ProgramPatchPayload = {
  status: 'preview',
  dry_run: true,
  program_id: 'example',
  locale: 'en',
  rendered: 'Push A\n  Bench Press — 4 × 10 × 60 kg total — 120s rest',
  removed_days: [],
  added_days: [{ label: 'Push B' }],
  warnings: [],
  program: {
    name: 'Upper Hypertrophy',
    days: [
      {
        label: 'Push A',
        emoji: '💪',
        exercises: [
          {
            kind: 'solo',
            name: 'Bench Press',
            sets: 4,
            reps: '10',
            weightKg: 60,
            restSeconds: 120,
            targetDurationSeconds: null,
            isNew: false,
            change: ['sets'],
          },
        ],
      },
    ],
  },
}
