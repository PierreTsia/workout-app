import type { SessionCardLabels } from './types'

export const labels: Record<'en' | 'fr', SessionCardLabels> = {
  en: {
    title: 'Last session',
    tonnage: 'Tonnage',
    sets: 'sets',
    pr: 'PR',
    circuit: 'Circuit',
    time: 'Time',
    rounds: 'rounds',
    amrapGloss: 'As many rounds as possible.',
    empty: 'No sessions yet',
    emptyHint: 'Finish a workout and it will show up here.',
  },
  fr: {
    title: 'Dernière séance',
    tonnage: 'Tonnage',
    sets: 'séries',
    pr: 'PR',
    circuit: 'Circuit',
    time: 'Temps',
    rounds: 'tours',
    amrapGloss: 'Autant de tours que possible.',
    empty: 'Aucune séance',
    emptyHint: 'Termine une séance et elle apparaîtra ici.',
  },
}

export const labelsFor = (locale: 'en' | 'fr'): SessionCardLabels => labels[locale]
