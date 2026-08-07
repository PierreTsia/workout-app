"use no memo"

import { useState, useMemo, useCallback } from "react"
import {
  useTable,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
} from "@tanstack/react-table"
import { useTranslation } from "react-i18next"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Exercise } from "@/types/database"
import { normalizeForSearch } from "@/lib/search"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { getColumns } from "./columns"
import { DataTableToolbar } from "./DataTableToolbar"
import { DataTablePagination } from "./DataTablePagination"
import {
  exercisesTableFeatures,
  type ExercisesTableFeatures,
} from "./features"

interface DataTableProps {
  data: Exercise[]
}

export function DataTable({ data }: DataTableProps) {
  const { t } = useTranslation("admin")
  const { muscleLabel, equipmentLabel } = useCatalogLabels()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [reviewFilter, setReviewFilter] = useState("all")

  // Sorting stays on the canonical values behind the `accessorKey`s; only the
  // rendered cells follow the reader's locale.
  const columns = useMemo(
    () => getColumns(t, { muscleLabel, equipmentLabel }),
    [t, muscleLabel, equipmentLabel],
  )

  /**
   * Searches both spellings on purpose: the visible label, because typing what
   * is on screen has to work, and the stored value, because an admin who has
   * been typing "Pectoraux" for a year shouldn't have to stop.
   */
  const globalFilterFn = useMemo<FilterFn<ExercisesTableFeatures, Exercise>>(
    () => (row, _columnId, filterValue: string) => {
      const term = normalizeForSearch(filterValue)
      return [
        row.original.name,
        row.original.name_en ?? "",
        row.original.muscle_group,
        muscleLabel(row.original.muscle_group),
        equipmentLabel(row.original.equipment),
      ].some((field) => normalizeForSearch(field).includes(term))
    },
    [muscleLabel, equipmentLabel],
  )

  const reviewedCount = useMemo(
    () => data.filter((e) => e.reviewed_at).length,
    [data],
  )

  const handleReviewFilterChange = useCallback((value: string) => {
    setReviewFilter(value)
    setColumnFilters(value !== "all" ? [{ id: "reviewed", value }] : [])
  }, [])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useTable({
    features: exercisesTableFeatures,
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 50 },
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        table={table}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        reviewFilter={reviewFilter}
        onReviewFilterChange={handleReviewFilterChange}
        totalCount={data.length}
        reviewedCount={reviewedCount}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  )
}
