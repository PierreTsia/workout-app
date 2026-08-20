import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { SessionHistoryBody } from "@/components/history/SessionHistoryBody"
import { formatDate } from "@/lib/formatters"
import { formatSessionRowDuration } from "@/lib/sessionRowDuration"
import type { Session } from "@/types/database"

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
        {expanded && <SessionHistoryBody sessionId={s.id} />}
      </CollapsibleContent>
    </Collapsible>
  )
}
