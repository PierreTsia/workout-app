import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Check, X, Pencil } from "lucide-react"
import { Link } from "react-router-dom"
import type { Exercise } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function getColumns(t: (key: string) => string): ColumnDef<Exercise>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("columns.name")}
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.emoji}</span>
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "muscle_group",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("columns.muscleGroup")}
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {row.original.muscle_group}
        </Badge>
      ),
    },
    {
      accessorKey: "equipment",
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("columns.equipment")}
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.equipment || "—"}
        </span>
      ),
    },
    {
      id: "has_youtube",
      header: t("columns.youtube"),
      cell: ({ row }) =>
        row.original.youtube_url ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground/40" />
        ),
      filterFn: (row, _id, value) => {
        if (value === "all") return true
        const has = !!row.original.youtube_url
        return value === "yes" ? has : !has
      },
    },
    {
      id: "has_image",
      header: t("columns.image"),
      cell: ({ row }) =>
        row.original.image_url ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground/40" />
        ),
    },
    {
      id: "has_instructions",
      header: t("columns.instructions"),
      cell: ({ row }) => {
        const ins = row.original.instructions
        const has =
          ins &&
          (ins.setup.length > 0 ||
            ins.movement.length > 0 ||
            ins.breathing.length > 0 ||
            ins.common_mistakes.length > 0)
        return has ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground/40" />
        )
      },
    },
    {
      id: "reviewed",
      accessorFn: (row) => (row.reviewed_at ? "reviewed" : "not_reviewed"),
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("columns.reviewStatus")}
          <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) =>
        row.original.reviewed_at ? (
          <Badge variant="default" className="bg-green-600 text-xs">
            {t("reviewed")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {t("notReviewed")}
          </Badge>
        ),
      filterFn: (row, _id, value) => {
        if (value === "all") return true
        const isReviewed = !!row.original.reviewed_at
        return value === "reviewed" ? isReviewed : !isReviewed
      },
    },
    {
      id: "actions",
      header: t("columns.actions"),
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to={`/admin/exercises/${row.original.id}`}>
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
      ),
    },
  ]
}
