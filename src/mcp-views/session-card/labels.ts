import enBuilder from '../../locales/en/builder.json'
import frBuilder from '../../locales/fr/builder.json'
import enHistory from '../../locales/en/history.json'
import frHistory from '../../locales/fr/history.json'
import enProfile from '../../locales/en/profile.json'
import frProfile from '../../locales/fr/profile.json'
import enWorkout from '../../locales/en/workout.json'
import frWorkout from '../../locales/fr/workout.json'
import type { SessionCardLabels } from './types'

/**
 * The card reuses **existing app keys** (0 new copy): embedded EN+FR at build time, so the
 * view needs no i18n runtime. The core stays i18n-neutral (ADR 0015/0018); the app supplies
 * the words. `workout.json` uses flat dotted keys, the others nested ones.
 */
const build = (
  w: typeof enWorkout,
  h: typeof enHistory,
  p: typeof enProfile,
  b: typeof enBuilder,
): SessionCardLabels => ({
  title: w['recap.tabLastSession'],
  tonnage: p.tonnage.title,
  sets: h.sets,
  pr: h.pr,
  circuit: h.circuit.fallbackLabel,
  amrapGloss: b.amrapGloss,
  completionTime: h.circuit.completionTime,
  roundsOne: h.circuit.rounds_one,
  roundsOther: h.circuit.rounds_other,
  empty: h.noSessions,
  emptyHint: h.noSessionsHint,
})

export const labels: Record<'en' | 'fr', SessionCardLabels> = {
  en: build(enWorkout, enHistory, enProfile, enBuilder),
  fr: build(frWorkout, frHistory, frProfile, frBuilder),
}

export const labelsFor = (locale: 'en' | 'fr'): SessionCardLabels => labels[locale]
