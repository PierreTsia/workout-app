import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useProgramExercisePreview } from "@/hooks/useProgramExercisePreview"

export const PROGRAM_PREVIEW_LIMIT = 8

export function ProgramBadgePopover({
  programId,
  programName,
  label,
  variant,
}: {
  programId: string
  programName: string
  label: string
  variant: NonNullable<BadgeProps["variant"]>
}) {
  const { t } = useTranslation("profile")
  const [open, setOpen] = useState(false)
  const { data, isPending, isError } = useProgramExercisePreview(programId, open)
  const items = data ?? []
  const visible = items.slice(0, PROGRAM_PREVIEW_LIMIT)
  const remainder = items.length - visible.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge variant={variant} className="cursor-pointer">
          {label}
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-72 max-w-[calc(100vw-2rem)]"
      >
        <p className="text-sm font-semibold">{programName}</p>
        {isPending ? (
          <div className="mt-3 flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-36" />
          </div>
        ) : isError ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("error")}</p>
        ) : visible.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("hero.previewEmpty")}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {visible.map((item) => (
              <li key={item.exerciseId} className="flex items-center text-sm">
                <span className="truncate">
                  {item.emoji} {item.name}
                </span>
              </li>
            ))}
            {remainder > 0 ? (
              <li className="text-xs text-muted-foreground">
                {t("hero.moreExercises", { n: remainder })}
              </li>
            ) : null}
          </ul>
        )}
        <Separator className="my-3" />
        <Button variant="link" className="h-auto p-0" asChild>
          <Link to={`/builder/${programId}`}>{t("hero.openProgram")}</Link>
        </Button>
      </PopoverContent>
    </Popover>
  )
}
