import { describe, expect, it } from 'vitest'

import { labelsFor } from './labels'
import { renderMarkup } from './render'
import type { ProgramPatchPayload } from './types'

const payload = (extra: Partial<ProgramPatchPayload> = {}): ProgramPatchPayload => ({
  status: 'preview',
  program_id: 'p1',
  removed_days: [],
  added_days: [],
  program: {
    name: 'PUSH',
    days: [
      {
        label: 'Push A',
        emoji: '💪',
        exercises: [
          {
            kind: 'solo',
            name: 'Développé couché',
            sets: 4,
            reps: '10',
            weightKg: 60,
            restSeconds: 90,
            targetDurationSeconds: null,
            isNew: false,
            change: ['weight'],
          },
        ],
      },
    ],
  },
  ...extra,
})

describe("Decision Card labels follow the Display Locale (#677)", () => {
  it("renders French copy for a French card", () => {
    const html = renderMarkup(payload(), labelsFor('fr'), 'preview')

    expect(html).toContain('repos 90 s')
    expect(html).toContain('Appliquer')
    expect(html).toContain('À approuver')
    expect(html).toContain('Poids modifié')
    expect(html).not.toContain('Apply')
  })

  it("renders English copy for an English card", () => {
    const html = renderMarkup(payload(), labelsFor('en'), 'preview')

    expect(html).toContain('rest 90 s')
    expect(html).toContain('Apply')
  })
})

describe("Decision Card warnings follow the Display Locale (#677)", () => {
  it("composes warning_details in French", () => {
    const html = renderMarkup(
      payload({
        warning_details: [
          { kind: 'active_cycle', date: '2026-10-01' },
          { kind: 'slot_detachment', exercise: 'Développé couché' },
        ],
      }),
      labelsFor('fr'),
      'preview',
    )

    expect(html).toContain('Cycle actif depuis 2026-10-01')
    expect(html).toContain('Historique détaché')
    expect(html).not.toContain('Active cycle since')
  })

  it("composes warning_details in English, not the French fallback strings", () => {
    const html = renderMarkup(
      payload({
        warnings: ['Cycle actif depuis 2026-10-01'],
        warning_details: [{ kind: 'active_cycle', date: '2026-10-01' }],
      }),
      labelsFor('en'),
      'preview',
    )

    expect(html).toContain('Active cycle since 2026-10-01')
    expect(html).not.toContain('Cycle actif depuis')
  })
})
