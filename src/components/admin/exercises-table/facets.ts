import type { TFunction } from "i18next"
import type { FilterFn } from "@tanstack/react-table"
import type { DataTableFeatures, FacetDef } from "@nomosui/react"
import type { Exercise } from "@/types/database"
import { normalizeForSearch } from "@/lib/search"
import type { CatalogLabels } from "./columns"

/**
 * The review tri-state as a core facet. Id matches the `reviewed` column so the
 * shell routes the selection into that column's filter; `all` is the wildcard
 * option the old segmented control exposed.
 */
export function reviewStatusFacet(
  t: TFunction<"admin">,
  exercises: Exercise[],
): FacetDef {
  const reviewed = exercises.filter((exercise) => exercise.reviewed_at).length
  return {
    id: "reviewed",
    label: t("reviewedFilter"),
    options: [
      { value: "all", label: t("allReviewStatus"), count: exercises.length },
      {
        value: "not_reviewed",
        label: t("notReviewed"),
        count: exercises.length - reviewed,
      },
      { value: "reviewed", label: t("reviewed"), count: reviewed },
    ],
  }
}

/**
 * Searches both spellings on purpose: the visible label, because typing what is
 * on screen has to work, and the stored value, because an admin who has been
 * typing "Pectoraux" for a year shouldn't have to stop.
 */
export function exerciseGlobalFilterFn({
  muscleLabel,
  equipmentLabel,
}: CatalogLabels): FilterFn<DataTableFeatures, Exercise> {
  return (row, _columnId, filterValue) => {
    const term = normalizeForSearch(String(filterValue))
    return [
      row.original.name,
      row.original.name_en ?? "",
      row.original.muscle_group,
      muscleLabel(row.original.muscle_group),
      equipmentLabel(row.original.equipment),
    ].some((field) => normalizeForSearch(field).includes(term))
  }
}
