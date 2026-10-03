import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { FacetedDataTable, type TableState } from "@nomosui/react"
import { useAdminExercises } from "@/hooks/useAdminExercises"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { buildDataTableLabels } from "@/components/admin/tableLabels"
import {
  exerciseGlobalFilterFn,
  reviewStatusFacet,
} from "@/components/admin/exercises-table/facets"
import { getColumns } from "@/components/admin/exercises-table/columns"

/**
 * Columns that only earn their width on a desktop viewport. Below `sm` the
 * core table would otherwise force a horizontal scroll, the @qa 390px
 * overflow: name, review status and the edit action are what stays.
 */
const MOBILE_HIDDEN_COLUMN_IDS = new Set([
  "muscle_group",
  "equipment",
  "has_youtube",
  "has_image",
  "has_instructions",
])

const INITIAL_TABLE_STATE: TableState = {
  sorting: [],
  globalFilter: "",
  columnFilters: [],
  pagination: { pageIndex: 0, pageSize: 50 },
  openedKey: null,
  selection: [],
  columnVisibility: {},
  columnOrder: [],
}

export function AdminExercisesPage() {
  const { t } = useTranslation("admin")
  const { data: exercises, isLoading } = useAdminExercises()
  const { muscleLabel, equipmentLabel } = useCatalogLabels()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  // The core's uncontrolled default page size is 25; the admin baseline is 50,
  // so the page owns the table state to pin it.
  const [tableState, setTableState] = useState(INITIAL_TABLE_STATE)

  const labels = useMemo(() => buildDataTableLabels(t), [t])
  const facets = useMemo(
    () => [reviewStatusFacet(t, exercises ?? [])],
    [t, exercises],
  )
  const globalFilterFn = useMemo(
    () => exerciseGlobalFilterFn({ muscleLabel, equipmentLabel }),
    [muscleLabel, equipmentLabel],
  )
  const renderColumns = useCallback(
    () =>
      getColumns(t, { muscleLabel, equipmentLabel }).filter(
        (column) => isDesktop || !MOBILE_HIDDEN_COLUMN_IDS.has(String(column.id)),
      ),
    [t, muscleLabel, equipmentLabel, isDesktop],
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">{t("exercises")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("exercisesDescription")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <FacetedDataTable
          data={exercises ?? []}
          renderColumns={renderColumns}
          facets={facets}
          globalFilterFn={globalFilterFn}
          labels={labels}
          state={tableState}
          onStateChange={setTableState}
        />
      )}
    </div>
  )
}
