import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { useSessionHistory } from "@/hooks/useSessionHistory"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { computeEpley1RM } from "@/lib/epley"
import { formatDate } from "@/lib/formatters"
import type { Session, SetLog } from "@/types/database"

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "–"
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  const totalMin = Math.round(ms / 60_000)
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${m}m`
}

function groupByExercise(logs: SetLog[]) {
  const groups: { name: string; sets: SetLog[] }[] = []
  let current: { name: string; sets: SetLog[] } | null = null

  for (const log of logs) {
    if (!current || current.name !== log.exercise_name_snapshot) {
      current = { name: log.exercise_name_snapshot, sets: [] }
      groups.push(current)
    }
    current.sets.push(log)
  }

  return groups
}

function SessionSetLogs({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation("history")
  const { formatWeight } = useWeightUnit()
  const { data: logs, isLoading } = useSessionSetLogs(sessionId)

  if (isLoading) {
    return <p className="py-2 text-xs text-muted-foreground">{t("loadingSets")}</p>
  }

  if (!logs || logs.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">{t("noSetsRecorded")}</p>
  }

  const groups = groupByExercise(logs)

  return (
    <div className="flex flex-col gap-3 pb-2 pt-1">
      {groups.map((group) => (
        <div key={group.name}>
          <p className="mb-1 text-xs font-semibold text-foreground">{group.name}</p>
          <div className="grid grid-cols-[2rem_1fr_1fr_1fr_auto] gap-x-2 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">#</span>
            <span className="text-muted-foreground">{t("workout:reps", { defaultValue: "Reps" })}</span>
            <span className="text-muted-foreground">{t("weightUnit")}</span>
            <span className="text-muted-foreground">{t("oneRm")}</span>
            <span />
            {group.sets.map((s) => {
              const e1rm =
                s.estimated_1rm != null
                  ? Number(s.estimated_1rm)
                  : computeEpley1RM(Number(s.weight_logged), parseInt(s.reps_logged, 10))
              return (
                <SetRow key={s.id} set={s} e1rm={e1rm} formatWeight={formatWeight} prLabel={t("pr")} />
              )
            })}
          </div>
        </div>
      ))}
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
      <span className="tabular-nums">{set.reps_logged}</span>
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

function SessionRow({ session: s }: { session: Session }) {
  const { t, i18n } = useTranslation("history")
  const [expanded, setExpanded] = useState(false)

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/50">
        <div className="flex-1">
          <p className="text-sm font-medium">{s.workout_label_snapshot}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(s.started_at, i18n.language, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}{" "}
            · {formatDuration(s.started_at, s.finished_at)} · {s.total_sets_done}{" "}
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

export function SessionList() {
  const { t } = useTranslation("history")
  const { data: sessions, isLoading } = useSessionHistory()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t("noSessions")}</p>
        <p className="text-xs text-muted-foreground">
          {t("noSessionsHint")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {sessions.map((session) => (
        <SessionRow key={session.id} session={session} />
      ))}
    </div>
  )
}
