/**
 * Server twin of `file:src/lib/catalogLabels.ts` (ADR 0010 / ADR 0035). The MCP layer
 * cannot reach `src/locales`, so the label rules live here, pure and testable.
 */

export type DisplayLocale = "en" | "fr"

export type CatalogNameSource = {
  name?: string | null
  name_en?: string | null
  name_snapshot?: string | null
}

const isEnglish = (locale: string): boolean => locale.toLowerCase().startsWith("en")

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function resolveDisplayName(source: CatalogNameSource, locale: DisplayLocale): string {
  const english = isEnglish(locale) ? clean(source.name_en) : null
  return english ?? clean(source.name) ?? clean(source.name_snapshot) ?? ""
}

/**
 * The 13 canonical `muscle_group` values (French in the DB) → their English labels.
 * Must stay identical to `file:src/locales/en/catalog.json`'s `muscles` map; a parity
 * test guards the two from drifting.
 */
const MUSCLE_LABELS_EN: Readonly<Record<string, string>> = {
  Pectoraux: "Chest",
  Dos: "Back",
  Épaules: "Shoulders",
  Biceps: "Biceps",
  Triceps: "Triceps",
  Quadriceps: "Quads",
  Ischios: "Hamstrings",
  Fessiers: "Glutes",
  Adducteurs: "Adductors",
  Mollets: "Calves",
  Abdos: "Abs",
  Trapèzes: "Traps",
  Lombaires: "Lower back",
}

export function muscleLabel(value: string | null | undefined, locale: DisplayLocale): string {
  const raw = clean(value)
  if (raw === null) return ""
  if (isEnglish(locale)) return MUSCLE_LABELS_EN[raw] ?? raw
  return raw
}

export type WarningKind = "active_cycle" | "slot_detachment"

export type WarningVars = { date?: string; exercise?: string }

/**
 * The `update_program` `dry_run` markdown warnings, localized. The French strings are
 * byte-identical to `formatActiveCycleWarning` / `formatSlotDetachmentWarning` they replace,
 * so a French reader sees no change.
 */
export function warningText(
  kind: WarningKind,
  locale: DisplayLocale,
  vars: WarningVars,
): string {
  const date = vars.date ?? ""
  const exercise = vars.exercise ?? ""
  if (isEnglish(locale)) {
    return kind === "active_cycle"
      ? `Active cycle since ${date} — this change affects your remaining workouts in this cycle.`
      : `History detached: "${exercise}" is removed or replaced — its progression restarts from the template prescription.`
  }
  return kind === "active_cycle"
    ? `Cycle actif depuis ${date} — cette modification affecte vos workouts restants dans ce cycle.`
    : `Historique détaché : « ${exercise} » est retiré ou remplacé — sa progression repart de la prescription du template.`
}
