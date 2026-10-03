import type { TFunction } from "i18next"
import type { DataTableLabels } from "@nomosui/react"

/**
 * Bridges the app's `admin` namespace to the core's `DataTableLabels`. The core
 * owns the table mechanics, not the words (ADR nomos 0010): every label the
 * shell needs is injected here from keys the admin namespace owns. Pages whose
 * copy differs from the exercises baseline override the few labels they own.
 */
export function buildDataTableLabels(
  t: TFunction<"admin">,
  overrides: Partial<DataTableLabels> = {},
): DataTableLabels {
  return {
    search: t("searchPlaceholder"),
    reset: t("reset"),
    clear: t("clear"),
    empty: t("noResults"),
    unit: t("exerciseCountUnit"),
    shown: (shown, total, unit) => t("tableShown", { shown, total, unit }),
    rows: t("pagination.rowsPerPage"),
    pageOf: (page, total) => t("pagination.page", { current: page, total }),
    previous: t("pagination.previous"),
    next: t("pagination.next"),
    ...overrides,
  }
}
