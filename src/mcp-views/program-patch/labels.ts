import enBuilder from '../../locales/en/builder.json'
import enHistory from '../../locales/en/history.json'
import enProgram from '../../locales/en/program.json'
import frBuilder from '../../locales/fr/builder.json'
import frHistory from '../../locales/fr/history.json'
import frProgram from '../../locales/fr/program.json'
import type { ProgramPatchLabels } from './types'

/**
 * The Decision Card's copy. New strings live under `program.mcpView.*` (EN+FR); Circuit
 * vocabulary (`Circuit`, `AMRAP` gloss, rounds) reuses the app's existing keys, embedded at
 * build time so the view needs no i18n runtime — same approach as the Session Card.
 */
const build = (
  p: typeof enProgram,
  h: typeof enHistory,
  b: typeof enBuilder,
): ProgramPatchLabels => {
  const m = p.mcpView
  return {
    title: m.title,
    apply: m.apply,
    applying: m.applying,
    applied: m.applied,
    error: m.error,
    statusPreview: m.statusPreview,
    consentNote: m.consentNote,
    removedOne: m.removedDays_one,
    removedOther: m.removedDays_other,
    addedOne: m.addedDays_one,
    addedOther: m.addedDays_other,
    changedSets: m.changedSets,
    changedReps: m.changedReps,
    changedWeight: m.changedWeight,
    changedRest: m.changedRest,
    reps: m.reps,
    rest: m.rest,
    circuit: h.circuit.fallbackLabel,
    amrapGloss: b.amrapGloss,
    roundsOne: h.circuit.rounds_one,
    roundsOther: h.circuit.rounds_other,
    circuitExercisesOne: m.circuitExercises_one,
    circuitExercisesOther: m.circuitExercises_other,
    warnActiveCycle: m.warnActiveCycle,
    warnSlotDetachment: m.warnSlotDetachment,
  }
}

export const labels: Record<'en' | 'fr', ProgramPatchLabels> = {
  en: build(enProgram, enHistory, enBuilder),
  fr: build(frProgram, frHistory, frBuilder),
}

export const labelsFor = (locale: 'en' | 'fr'): ProgramPatchLabels => labels[locale]
