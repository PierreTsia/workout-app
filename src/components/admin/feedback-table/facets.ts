import type { TFunction } from "i18next"
import type { FilterFn } from "@tanstack/react-table"
import type { DataTableFeatures, FacetDef } from "@nomosui/react"
import type { ExerciseContentFeedback, FeedbackStatus } from "@/types/database"
import { normalizeForSearch } from "@/lib/search"

export const FEEDBACK_STATUSES: FeedbackStatus[] = [
  "pending",
  "in_review",
  "resolved",
]

/** The label for one status, shared by the facet, the badge and the Select. */
export function feedbackStatusLabel(
  t: TFunction<"admin">,
  status: FeedbackStatus,
): string {
  return status === "pending"
    ? t("feedback.pending")
    : status === "in_review"
      ? t("feedback.inReview")
      : t("feedback.resolved")
}

/**
 * The status filter as a core facet. Id matches the `status` column so the
 * shell routes the selection into that column's filter. No "all" wildcard: the
 * facet is multi-select, so `all` unioned with a real value and silently
 * cancelled the filter. Counts come from the loaded rows, like the exercises
 * review facet; the unfiltered state is the facet's Clear action.
 */
export function statusFacet(
  t: TFunction<"admin">,
  rows: ExerciseContentFeedback[],
): FacetDef {
  return {
    id: "status",
    label: t("feedback.columns.status"),
    options: FEEDBACK_STATUSES.map((status) => ({
      value: status,
      label: feedbackStatusLabel(t, status),
      count: rows.filter((row) => row.status === status).length,
    })),
  }
}

/**
 * Searches the exercise name and the reporter's email. The old table matched
 * both; diacritics are stripped so "developpe" finds "Développé".
 */
export const feedbackGlobalFilterFn: FilterFn<
  DataTableFeatures,
  ExerciseContentFeedback
> = (row, _columnId, filterValue) => {
  const term = normalizeForSearch(String(filterValue))
  return [row.original.exercises?.name ?? "", row.original.user_email].some(
    (field) => normalizeForSearch(field).includes(term),
  )
}