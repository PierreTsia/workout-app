import { useTranslation } from "react-i18next"
import { SessionHistoryBody } from "@/components/history/SessionHistoryBody"
import { ProgrammeSequenceList } from "@/components/workout/ProgrammeSequenceList"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSessionBlockMeta } from "@/hooks/useSessionBlockMeta"
import { useSessionBlockRuns } from "@/hooks/useSessionBlockRuns"
import { useSessionSetLogs } from "@/hooks/useSessionSetLogs"
import type { LastSessionInfo } from "@/hooks/useLastSessionForDay"
import { buildDayItems } from "@/lib/dayItems"
import {
  formatRelativeDate,
  formatSessionDurationForDisplay,
} from "@/lib/formatters"
import {
  sessionCoverage,
  type SessionCoverage,
} from "@/lib/sessionCoverage"
import { groupSessionHistory } from "@/lib/sessionHistoryGrouping"
import type {
  ExerciseBlockWithExercises,
  WorkoutExerciseWithLabel,
} from "@/types/database"

function CoverageFactLine({
  logged,
  program,
}: {
  logged: number
  program: number
}) {
  const { t } = useTranslation("workout")
  return (
    <p className="text-xs text-muted-foreground">
      {t("recap.coverage", { logged, program })}
    </p>
  )
}

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

  const blockExerciseIds = (logs ?? [])
    .map((log) => log.block_exercise_id)
    .filter((id): id is string => id != null)
  const { data: blockMeta } = useSessionBlockMeta(blockExerciseIds)
  const { data: blockRuns } = useSessionBlockRuns(sessionId ?? undefined)

  if (lastSession === undefined) return null
  if (sessionId != null && !isSuccess) return null
  if (lastSession == null || !logs?.length) {
    return <ProgrammeSequenceList exercises={exercises} blocks={blocks} />
  }

  const metaPending = blockExerciseIds.length > 0 && blockMeta == null
  const coverage: SessionCoverage = metaPending
    ? { comparable: false }
    : sessionCoverage(
        groupSessionHistory(logs, blockMeta ?? new Map()),
        blockRuns ?? new Map(),
        buildDayItems(exercises, blocks),
      )

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
        <div className="mb-2 flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">
            {formatRelativeDate(lastSession.finished_at, i18n.language)}
            {" · "}
            {formatSessionDurationForDisplay(
              lastSession.started_at,
              lastSession.finished_at,
              lastSession.active_duration_ms,
            )}
          </p>
          {coverage.comparable && !coverage.equal ? (
            <CoverageFactLine
              logged={coverage.loggedItems}
              program={coverage.programItems}
            />
          ) : null}
        </div>
        <SessionHistoryBody sessionId={lastSession.id} />
      </TabsContent>
      <TabsContent value="program">
        <ProgrammeSequenceList exercises={exercises} blocks={blocks} />
      </TabsContent>
    </Tabs>
  )
}
