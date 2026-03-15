import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"
import type { ExerciseContentFeedback } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import { StatusDropdown } from "./StatusDropdown"

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: "border-yellow-500/50 text-yellow-600 dark:text-yellow-400",
  in_review: "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  resolved: "border-transparent bg-green-600 text-white",
}

function truncate(text: string | null, max: number): string {
  if (!text) return "—"
  return text.length > max ? text.slice(0, max) + "…" : text
}

export function getColumns(
  t: (key: string) => string,
  locale: string,
): ColumnDef<ExerciseContentFeedback>[] {
  return [
    {
      id: "expand",
      header: () => null,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => row.toggleExpanded()}
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      ),
    },
    {
      id: "exercise",
      accessorKey: "exercise_id",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("feedback.columns.exercise")}
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const ex = row.original.exercises
        if (!ex) {
          return (
            <span className="text-muted-foreground">
              ❓ {t("feedback.unknownExercise")}
            </span>
          )
        }
        return (
          <Link
            to={`/admin/exercises/${row.original.exercise_id}`}
            className="flex items-center gap-2 hover:underline"
          >
            <span>{ex.emoji}</span>
            <span className="font-medium">{ex.name}</span>
          </Link>
        )
      },
      sortingFn: (a, b) => {
        const nameA = a.original.exercises?.name ?? ""
        const nameB = b.original.exercises?.name ?? ""
        return nameA.localeCompare(nameB)
      },
    },
    {
      accessorKey: "fields_reported",
      header: t("feedback.columns.fieldsReported"),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.fields_reported.map((field) => (
            <Badge key={field} variant="secondary" className="text-xs">
              {t(`feedback.fields.${field}`)}
            </Badge>
          ))}
        </div>
      ),
      filterFn: (row, _id, filterValue: string) => {
        if (!filterValue) return true
        return row.original.fields_reported.includes(filterValue)
      },
    },
    {
      accessorKey: "source_screen",
      header: t("feedback.columns.sourceScreen"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {t(`feedback.source.${row.original.source_screen}`)}
        </span>
      ),
    },
    {
      accessorKey: "user_email",
      header: t("feedback.columns.userEmail"),
      cell: ({ row }) => (
        <span className="max-w-[160px] truncate text-sm text-muted-foreground" title={row.original.user_email}>
          {row.original.user_email}
        </span>
      ),
    },
    {
      accessorKey: "comment",
      header: t("feedback.columns.comment"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground" title={row.original.comment ?? undefined}>
          {truncate(row.original.comment, 60)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("feedback.columns.status")}
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const status = row.original.status
        const label =
          status === "pending"
            ? t("feedback.pending")
            : status === "in_review"
              ? t("feedback.inReview")
              : t("feedback.resolved")
        return (
          <Badge variant="outline" className={STATUS_BADGE_CLASSES[status] ?? ""}>
            {label}
          </Badge>
        )
      },
      filterFn: (row, _id, filterValue: string) => {
        if (filterValue === "all") return true
        return row.original.status === filterValue
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("feedback.columns.submitted")}
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatRelativeTime(row.original.created_at, locale)}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("feedback.columns.actions"),
      cell: ({ row, table }) => {
        const meta = table.options.meta as { adminEmail: string } | undefined
        return (
          <StatusDropdown
            feedbackId={row.original.id}
            currentStatus={row.original.status}
            adminEmail={meta?.adminEmail ?? "unknown"}
          />
        )
      },
    },
  ]
}
