import type { SessionCardPayload } from './types'

export const examplePayload: SessionCardPayload = {
  locale: 'en',
  session: {
    id: '00000000-0000-0000-0000-000000000000',
    label: 'Push day',
    finishedAtLabel: 'Yesterday',
    durationLabel: '52 min',
    setsDone: 14,
  },
  tonnageKg: 4250,
  items: [
    {
      kind: 'solo',
      name: 'Bench press',
      sets: [
        { measure: '8 reps', weightKg: 60, isPr: false },
        { measure: '8 reps', weightKg: 62.5, isPr: true },
      ],
    },
    {
      kind: 'circuit',
      label: 'Cindy',
      mode: 'amrap',
      rounds: 12,
      amrap: { fullRounds: 12, leftover: 3, leftoverName: 'push-ups' },
    },
  ],
}
