import { Link } from "react-router-dom"
import { MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AdminOnly } from "@/components/admin/AdminOnly"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ExerciseOverflowMenuProps {
  exerciseId: string
  onEditDetails: () => void
  onRemove: () => void
}

export function ExerciseOverflowMenu({
  exerciseId,
  onEditDetails,
  onRemove,
}: ExerciseOverflowMenuProps) {
  const { t } = useTranslation("builder")
  const { t: tWorkout } = useTranslation("workout")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={t("moreAria")}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEditDetails}>
          {t("editDetails")}
        </DropdownMenuItem>
        <AdminOnly>
          <DropdownMenuItem asChild>
            <Link to={`/admin/exercises/${exerciseId}`}>
              {tWorkout("session.menuEditInAdmin")}
            </Link>
          </DropdownMenuItem>
        </AdminOnly>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={onRemove}
        >
          {t("remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
