"use no memo"

import { useState, useMemo, useCallback, Fragment } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type ExpandedState,
  type FilterFn,
} from "@tanstack/react-table"
import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExerciseContentFeedback } from "@/types/database"
import { authAtom } from "@/store/atoms"
import { getColumns } from "./columns"
import { DataTableToolbar } from "./DataTableToolbar"
import { FeedbackDetailRow } from "./FeedbackDetailRow"

const globalFilterFn: FilterFn<ExerciseContentFeedback> = (
  row,
  _columnId,
  filterValue: string,
) => {
  const search = filterValue.toLowerCase()
  const name = (row.original.exercises?.name ?? "").toLowerCase()
  const email = row.original.user_email.toLowerCase()
  return name.includes(search) || email.includes(search)
}

interface DataTableProps {
  data: ExerciseContentFeedback[]
}

export function DataTable({ data }: DataTableProps) {
  const { t, i18n } = useTranslation("admin")
  const user = useAtomValue(authAtom)
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [statusFilter, setStatusFilter] = useState("all")

  const columns = useMemo(() => getColumns(t, i18n.language), [t, i18n.language])

  const pendingCount = useMemo(
    () => data.filter((f) => f.status === "pending").length,
    [data],
  )

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value)
    setColumnFilters(value !== "all" ? [{ id: "status", value }] : [])
  }, [])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      expanded,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    globalFilterFn,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    meta: {
      adminEmail: user?.email ?? "unknown",
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        totalCount={data.length}
        pendingCount={pendingCount}
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
                <Fragment key={row.id}>
                  <TableRow>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="bg-muted/30 p-0">
                        <FeedbackDetailRow feedback={row.original} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {t("feedback.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
