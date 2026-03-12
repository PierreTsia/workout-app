import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { useSessionHistory } from "@/hooks/useSessionHistory"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import { computeEpley1RM } from "@/lib/epley"
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
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
  const { data: logs, isLoading } = useSessionSetLogs(sessionId)

  if (isLoading) {
    return <p className="py-2 text-xs text-muted-foreground">Loading sets…</p>
  }

  if (!logs || logs.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">No sets recorded.</p>
  }

  const groups = groupByExercise(logs)

  return (
    <div className="flex flex-col gap-3 pb-2 pt-1">
      {groups.map((group) => (
        <div key={group.name}>
          <p className="mb-1 text-xs font-semibold text-foreground">{group.name}</p>
          <div className="grid grid-cols-[2rem_1fr_1fr_1fr_auto] gap-x-2 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">#</span>
            <span className="text-muted-foreground">Reps</span>
            <span className="text-muted-foreground">Weight</span>
            <span className="text-muted-foreground">1RM</span>
            <span />
            {group.sets.map((s) => {
              const e1rm =
                s.estimated_1rm != null
                  ? Number(s.estimated_1rm)
                  : computeEpley1RM(Number(s.weight_logged), parseInt(s.reps_logged, 10))
              return (
                <SetRow key={s.id} set={s} e1rm={e1rm} />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function SetRow({ set, e1rm }: { set: SetLog; e1rm: number }) {
  return (
    <>
      <span className="tabular-nums">{set.set_number}</span>
      <span className="tabular-nums">{set.reps_logged}</span>
      <span className="tabular-nums">{set.weight_logged}kg</span>
      <span className="tabular-nums">{e1rm > 0 ? `${Math.round(e1rm)}` : "–"}</span>
      {set.was_pr ? (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          PR
        </Badge>
      ) : (
        <span />
      )}
    </>
  )
}

function SessionRow({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/50">
        <div className="flex-1">
          <p className="text-sm font-medium">{session.workout_label_snapshot}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(session.started_at)} · {formatDuration(session.started_at, session.finished_at)} · {session.total_sets_done} sets
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3">
        {expanded && <SessionSetLogs sessionId={session.id} />}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function SessionList() {
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
        <p className="text-sm text-muted-foreground">No sessions yet.</p>
        <p className="text-xs text-muted-foreground">
          Complete a workout and it will show up here.
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
