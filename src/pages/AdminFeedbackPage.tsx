import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import {
  EmptyState,
  FacetedDataTable,
  type RowDetail,
  type TableState,
} from "@nomosui/react"
import { useAdminFeedback } from "@/hooks/useAdminFeedback"
import { authAtom } from "@/store/atoms"
import { buildDataTableLabels } from "@/components/admin/tableLabels"
import {
  feedbackGlobalFilterFn,
  statusFacet,
} from "@/components/admin/feedback-table/facets"
import { getColumns } from "@/components/admin/feedback-table/columns"
import { FeedbackDetailRow } from "@/components/admin/feedback-table/FeedbackDetailRow"
import type { ExerciseContentFeedback } from "@/types/database"

/**
 * Feedback reuses the exercises baseline but owns its copy. The core offers no
 * "no pagination" switch and its page sizes are 10/25/50/100, so 100 keeps the
 * whole feedback list on one page — the pre-migration behaviour — until the
 * volume actually needs paging.
 */
const INITIAL_TABLE_STATE: TableState = {
  sorting: [],
  globalFilter: "",
  columnFilters: [],
  pagination: { pageIndex: 0, pageSize: 100 },
  openedKey: null,
  selection: [],
  columnVisibility: {},
  columnOrder: [],
}

const rowKey = (row: ExerciseContentFeedback) => row.id

export function AdminFeedbackPage() {
  const { t, i18n } = useTranslation("admin")
  const { data: feedback, isLoading } = useAdminFeedback()
  const reports = useMemo(() => feedback ?? [], [feedback])
  const adminEmail = useAtomValue(authAtom)?.email ?? "unknown"

  const [tableState, setTableState] = useState(INITIAL_TABLE_STATE)

  const labels = useMemo(
    () =>
      buildDataTableLabels(t, {
        search: t("feedback.searchPlaceholder"),
        empty: t("feedback.noResults"),
        unit: t("feedback.countUnit"),
      }),
    [t],
  )
  const facets = useMemo(() => [statusFacet(t, reports)], [t, reports])
  const renderColumns = useCallback(
    (openDetail: (row: ExerciseContentFeedback) => void) =>
      getColumns(t, i18n.language, adminEmail, openDetail),
    [t, i18n.language, adminEmail],
  )
  const detail = useMemo<RowDetail<ExerciseContentFeedback>>(
    () => ({
      placement: "inline",
      render: (row) => <FeedbackDetailRow feedback={row} />,
    }),
    [],
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">{t("feedback.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("feedback.description")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState title={t("feedback.noResults")} />
        </div>
      ) : (
        <FacetedDataTable
          data={reports}
          renderColumns={renderColumns}
          facets={facets}
          globalFilterFn={feedbackGlobalFilterFn}
          labels={labels}
          detail={detail}
          rowKey={rowKey}
          state={tableState}
          onStateChange={setTableState}
        />
      )}
    </div>
  )
}
