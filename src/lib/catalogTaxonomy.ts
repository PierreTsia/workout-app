/**
 * Canonical equipment slugs as stored in `exercises.equipment`.
 *
 * The column is plain `text` with no CHECK constraint, so nothing at the schema
 * level keeps this list complete — `src/locales/catalogParity.test.ts` ties it
 * to the `catalog` i18n tables instead. The muscle counterpart already lives in
 * `MUSCLE_TAXONOMY` (src/lib/trainingBalance.ts) and is not duplicated here.
 */
export const EQUIPMENT_TAXONOMY = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "bench",
  "ez_bar",
  "band",
  "other",
] as const

export type EquipmentTaxonomy = (typeof EQUIPMENT_TAXONOMY)[number]
