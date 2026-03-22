import { useTranslation } from "react-i18next"
import { useSessionHistory } from "@/hooks/useSessionHistory"
import { SessionRow } from "@/components/history/SessionRow"

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
