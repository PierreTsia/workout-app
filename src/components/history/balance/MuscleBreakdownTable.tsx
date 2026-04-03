import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import type { VolumeByMuscleRow } from "@/lib/volumeByMuscleGroup"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

function muscleLabel(t: (k: string, o?: object) => string, key: string) {
  return t(`balance.muscles.${key}`, { defaultValue: key })
}

interface MuscleBreakdownTableProps {
  muscles: readonly VolumeByMuscleRow[]
  className?: string
}

export function MuscleBreakdownTable({
  muscles,
  className,
}: MuscleBreakdownTableProps) {
  const { t } = useTranslation("history")
  const [open, setOpen] = useState(false)

  const totalSets = useMemo(
    () => muscles.reduce((s, m) => s + m.total_sets, 0),
    [muscles],
  )

  const rows = useMemo(() => {
    const denom = totalSets > 0 ? totalSets : 1
    return [...muscles]
      .map((m) => ({
        ...m,
        pct: (m.total_sets / denom) * 100,
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [muscles, totalSets])

  const fmtInt = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 0,
      }),
    [],
  )

  const fmtSets = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }),
    [],
  )

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-auto w-full items-center justify-between gap-2 px-0 py-2 font-medium hover:bg-transparent"
        >
          <span>{t("balance.breakdownTitle")}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("balance.colMuscle")}</TableHead>
              <TableHead className="text-right tabular-nums">
                {t("balance.colSets")}
              </TableHead>
              <TableHead className="text-right tabular-nums">
                {t("balance.colVolume")}
              </TableHead>
              <TableHead className="text-right tabular-nums">
                {t("balance.colShare")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.muscle_group}>
                <TableCell className="font-medium">
                  {muscleLabel(t, m.muscle_group)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtSets.format(m.total_sets)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtInt.format(m.total_volume_kg)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtInt.format(m.pct)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  )
}
