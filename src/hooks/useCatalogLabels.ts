import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  equipmentLabelKey,
  muscleLabelKey,
  resolveExerciseName,
  type CatalogNameSource,
} from "@/lib/catalogLabels"

/**
 * Binds the pure resolution rule (ADR 0010) to the reader's current locale.
 * Reads only what is already in the render tree — no query, no network.
 */
export function useCatalogLabels() {
  const { t, i18n } = useTranslation("catalog")
  const { language } = i18n

  return useMemo(
    () => ({
      exerciseName: (source: CatalogNameSource) =>
        resolveExerciseName(source, language),

      /** Falls back to the raw value: snapshots hold pre-taxonomy muscle names. */
      muscleLabel: (value: string | null | undefined) => {
        const key = muscleLabelKey(value)
        return key ? t(key) : (value ?? "")
      },

      equipmentLabel: (slug: string | null | undefined) => {
        const key = equipmentLabelKey(slug)
        return key ? t(key) : (slug ?? "")
      },
    }),
    [t, language],
  )
}
