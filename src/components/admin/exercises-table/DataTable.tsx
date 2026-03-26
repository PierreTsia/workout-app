"use no memo"

import { useState, useMemo, useCallback } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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
import { getColumns } from "./columns"
import { DataTableToolbar } from "./DataTableToolbar"
import { DataTablePagination } from "./DataTablePagination"

const globalFilterFn: FilterFn<Exercise> = (row, _columnId, filterValue: string) => {
  const term = normalizeForSearch(filterValue)
  const name = normalizeForSearch(row.original.name)
  const nameEn = normalizeForSearch(row.original.name_en ?? "")
  const muscle = normalizeForSearch(row.original.muscle_group)
  return name.includes(term) || nameEn.includes(term) || muscle.includes(term)
}

interface DataTableProps {
  data: Exercise[]
}

export function DataTable({ data }: DataTableProps) {
  const { t } = useTranslation("admin")
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [reviewFilter, setReviewFilter] = useState("all")

  const columns = useMemo(() => getColumns(t), [t])

  const reviewedCount = useMemo(
    () => data.filter((e) => e.reviewed_at).length,
    [data],
  )

  const handleReviewFilterChange = useCallback((value: string) => {
    setReviewFilter(value)
    setColumnFilters(value !== "all" ? [{ id: "reviewed", value }] : [])
  }, [])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
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
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
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
                  {row.getVisibleCells().map((cell) => (
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
