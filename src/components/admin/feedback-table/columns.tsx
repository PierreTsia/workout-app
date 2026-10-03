import type { TFunction } from "i18next"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge, Button, type DataTableFeatures } from "@nomosui/react"
import type { ExerciseContentFeedback, FeedbackStatus } from "@/types/database"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import { StatusDropdown } from "./StatusDropdown"
import { feedbackStatusLabel } from "./facets"

const STATUS_BADGE_CLASSES: Record<FeedbackStatus, string> = {
  pending: "border-yellow-500/50 text-yellow-600 dark:text-yellow-400",
  in_review: "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  resolved: "border-transparent bg-green-600 text-white",
}

function truncate(text: string | null, max: number): string {
  if (!text) return "—"
  return text.length > max ? text.slice(0, max) + "…" : text
}

export function getColumns(
  t: TFunction<"admin">,
  locale: string,
  adminEmail: string,
  openDetail: (row: ExerciseContentFeedback) => void,
): ColumnDef<DataTableFeatures, ExerciseContentFeedback>[] {
  return [
    {
      id: "expand",
      header: () => null,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={t("feedback.actions.expand")}
          onClick={(event) => {
            event.stopPropagation()
            openDetail(row.original)
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      ),
    },
    {
      id: "exercise",
      accessorFn: (row) => row.exercises?.name ?? "",
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
        <span
          className="max-w-[160px] truncate text-sm text-muted-foreground"
          title={row.original.user_email}
        >
          {row.original.user_email}
        </span>
      ),
    },
    {
      accessorKey: "comment",
      header: t("feedback.columns.comment"),
      cell: ({ row }) => (
        <span
          className="text-sm text-muted-foreground"
          title={row.original.comment ?? undefined}
        >
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
        return (
          <Badge variant="outline" className={STATUS_BADGE_CLASSES[status]}>
            {feedbackStatusLabel(t, status)}
          </Badge>
        )
      },
      filterFn: (row, _id, values: string[]) => {
        if (values.length === 0 || values.includes("all")) return true
        return values.includes(row.original.status)
      },
    },
    {
      accessorKey: "created_at",
      meta: { defaultSort: "desc" },
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
      cell: ({ row }) => (
        <StatusDropdown
          feedbackId={row.original.id}
          currentStatus={row.original.status}
          adminEmail={adminEmail}
        />
      ),
    },
  ]
}
