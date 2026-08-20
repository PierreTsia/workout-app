import { useTranslation } from "react-i18next"
import { SessionHistoryBody } from "@/components/history/SessionHistoryBody"
import { ProgrammeSequenceList } from "@/components/workout/ProgrammeSequenceList"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import type { LastSessionInfo } from "@/hooks/useLastSessionForDay"
import {
  formatRelativeDate,
  formatSessionDurationForDisplay,
} from "@/lib/formatters"
import type {
  ExerciseBlockWithExercises,
  WorkoutExerciseWithLabel,
} from "@/types/database"

export function LastSessionRecap({
  lastSession,
  exercises,
  blocks,
}: {
  lastSession: LastSessionInfo | null | undefined
  exercises: WorkoutExerciseWithLabel[]
  blocks: ExerciseBlockWithExercises[]
}) {
  const { t, i18n } = useTranslation("workout")
  const sessionId = lastSession?.id ?? null
  const { data: logs, isSuccess } = useSessionSetLogs(sessionId)

  if (lastSession === undefined) return null
  if (sessionId != null && !isSuccess) return null
  if (lastSession == null || !logs?.length) {
    return <ProgrammeSequenceList exercises={exercises} blocks={blocks} />
  }

  return (
    <Tabs defaultValue="last-session" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="last-session" className="flex-1 text-xs">
          {t("recap.tabLastSession")}
        </TabsTrigger>
        <TabsTrigger value="program" className="flex-1 text-xs">
          {t("recap.tabProgram")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="last-session">
        <p className="mb-2 text-xs text-muted-foreground">
          {formatRelativeDate(lastSession.finished_at, i18n.language)}
          {" · "}
          {formatSessionDurationForDisplay(
            lastSession.started_at,
            lastSession.finished_at,
            lastSession.active_duration_ms,
          )}
        </p>
        <SessionHistoryBody sessionId={lastSession.id} />
      </TabsContent>
      <TabsContent value="program">
        <ProgrammeSequenceList exercises={exercises} blocks={blocks} />
      </TabsContent>
    </Tabs>
  )
}
