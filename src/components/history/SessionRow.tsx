import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import { useSessionBlockMeta } from "@/hooks/useSessionBlockMeta"
import { useSessionBlockRuns } from "@/hooks/useSessionBlockRuns"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { computeEpley1RM } from "@/lib/epley"
import { formatDate, formatSecondsMMSS } from "@/lib/formatters"
import { formatSessionRowDuration } from "@/lib/sessionRowDuration"
import { groupSessionHistory, sheetCatalogId, type BlockHistoryGroup } from "@/lib/sessionHistoryGrouping"
import { BlockHistoryCard } from "@/components/history/BlockHistoryCard"
import { BlockHistorySheet } from "@/components/history/BlockHistorySheet"
import type { Session, SetLog } from "@/types/database"

function SessionSetLogs({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation("history")
  const { exerciseName } = useCatalogLabels()
  const { formatWeight } = useWeightUnit()
  const { data: logs, isLoading } = useSessionSetLogs(sessionId)
  const [openCircuit, setOpenCircuit] = useState<BlockHistoryGroup | null>(null)

  const blockExerciseIds = (logs ?? [])
    .map((l) => l.block_exercise_id)
    .filter((id): id is string => id != null)
  const { data: blockMeta } = useSessionBlockMeta(blockExerciseIds)
  const { data: blockRuns } = useSessionBlockRuns(sessionId)
  // Avoid a solo→circuit flash: wait for meta when the session has block logs.
  const metaPending = blockExerciseIds.length > 0 && blockMeta == null

  if (isLoading || metaPending) {
    return <p className="py-2 text-xs text-muted-foreground">{t("loadingSets")}</p>
  }

  if (!logs || logs.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">{t("noSetsRecorded")}</p>
  }

  const items = groupSessionHistory(logs, blockMeta ?? new Map())

  return (
    <div className="flex flex-col gap-3 pb-2 pt-1">
      {items.map((item) =>
        item.kind === "block" ? (
          <BlockHistoryCard
            key={item.key}
            group={item}
            formatWeight={formatWeight}
            onOpen={setOpenCircuit}
            blockRun={blockRuns?.get(item.key)}
          />
        ) : (
          <div key={item.key}>
            <p className="mb-1 text-xs font-semibold text-foreground">
              {exerciseName(item)}
            </p>
            <div className="grid grid-cols-[2rem_1fr_1fr_1fr_auto] gap-x-2 gap-y-0.5 text-xs">
              <span className="text-muted-foreground">#</span>
              <span className="text-muted-foreground">{t("workout:reps", { defaultValue: "Reps" })}</span>
              <span className="text-muted-foreground">{t("weightUnit")}</span>
              <span className="text-muted-foreground">{t("oneRm")}</span>
              <span />
              {item.sets.map((s) => {
                const e1rm =
                  s.duration_seconds != null
                    ? 0
                    : s.estimated_1rm != null
                      ? Number(s.estimated_1rm)
                      : computeEpley1RM(
                          Number(s.weight_logged),
                          parseInt(s.reps_logged ?? "0", 10),
                        )
                return (
                  <SetRow key={s.id} set={s} e1rm={e1rm} formatWeight={formatWeight} prLabel={t("pr")} />
                )
              })}
            </div>
          </div>
        ),
      )}
      <BlockHistorySheet
        open={openCircuit != null}
        onOpenChange={(o) => {
          if (!o) setOpenCircuit(null)
        }}
        blockId={openCircuit?.key ?? ""}
        catalogId={sheetCatalogId(
          openCircuit?.benchmarkCircuitId ?? null,
          openCircuit != null
            ? blockRuns?.get(openCircuit.key)?.benchmarkCircuitId
            : undefined,
        )}
        label={openCircuit?.label ?? null}
      />
    </div>
  )
}

function SetRow({
  set,
  e1rm,
  formatWeight,
  prLabel,
}: {
  set: SetLog
  e1rm: number
  formatWeight: (kg: number) => string
  prLabel: string
}) {
  return (
    <>
      <span className="tabular-nums">{set.set_number}</span>
      <span className="tabular-nums">
        {set.duration_seconds != null
          ? formatSecondsMMSS(set.duration_seconds)
          : (set.reps_logged ?? "–")}
      </span>
      <span className="tabular-nums">{formatWeight(Number(set.weight_logged))}</span>
      <span className="tabular-nums">{e1rm > 0 ? `${Math.round(e1rm)}` : "–"}</span>
      {set.was_pr ? (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {prLabel}
        </Badge>
      ) : (
        <span />
      )}
    </>
  )
}

export function SessionRow({ session: s }: { session: Session }) {
  const { t, i18n } = useTranslation("history")
  const { t: tGen } = useTranslation("generator")
  const [expanded, setExpanded] = useState(false)
  const isQuickSession = s.workout_label_snapshot.startsWith("Quick:")

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/50">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{s.workout_label_snapshot}</p>
            {isQuickSession && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {tGen("quickWorkoutBadge")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDate(s.started_at, i18n.language, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}{" "}
            ·{" "}
            {formatSessionRowDuration(
              s.started_at,
              s.finished_at,
              s.active_duration_ms,
            )}{" "}
            · {s.total_sets_done}{" "}
            {t("sets")}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3">
        {expanded && <SessionSetLogs sessionId={s.id} />}
      </CollapsibleContent>
    </Collapsible>
  )
}
