import enProgram from '../../locales/en/program.json'
import frProgram from '../../locales/fr/program.json'
import type { ProgramPatchLabels } from './types'

/**
 * The Decision Card's copy lives under `program.mcpView.*` (EN+FR), embedded at build time
 * so the view needs no i18n runtime — same approach as the Session Card. Values follow the
 * Tech Plan i18n contract; the wording pass is HITL (#648).
 */
const build = (p: typeof enProgram): ProgramPatchLabels => {
  const m = p.mcpView
  return {
    title: m.title,
    apply: m.apply,
    applying: m.applying,
    applied: m.applied,
    error: m.error,
    removedOne: m.removedDays_one,
    removedOther: m.removedDays_other,
    addedOne: m.addedDays_one,
    addedOther: m.addedDays_other,
  }
}

export const labels: Record<'en' | 'fr', ProgramPatchLabels> = {
  en: build(enProgram),
  fr: build(frProgram),
}

export const labelsFor = (locale: 'en' | 'fr'): ProgramPatchLabels => labels[locale]
