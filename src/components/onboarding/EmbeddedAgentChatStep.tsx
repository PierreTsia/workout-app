import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useAbandonThread, useThread } from "@/hooks/useEmbeddedAgentThread"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"

interface EmbeddedAgentChatStepProps {
  locale: "en" | "fr"
  onBack: () => void
}

const SHORT_ID_LENGTH = 8

function shortenId(id: string): string {
  return id.slice(0, SHORT_ID_LENGTH)
}

export function EmbeddedAgentChatStep({ locale, onBack }: EmbeddedAgentChatStepProps) {
  const { t } = useTranslation("onboarding")
  const isOnline = useOnlineStatus()
  const thread = useThread(locale)
  const abandon = useAbandonThread()

  const handleConfirmRestart = async () => {
    await abandon.mutateAsync()
  }

  // Story 11: leaving the chat from PathChoice abandons the active thread so
  // we never resume into an interrupted draft on the next visit.
  const handleBack = async () => {
    await abandon.mutateAsync()
    onBack()
  }

  // Story 8: never trap the user in an infinite spinner when the network is
  // gone. Surface an explicit offline banner whether the browser flagged it
  // upfront (`navigator.onLine === false`) or `/thread` itself errored.
  const isOffline = !isOnline || thread.isError

  if (isOffline) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-6 py-6">
        <Alert>
          <AlertTitle>{t("embeddedAgent.offlineTitle")}</AlertTitle>
          <AlertDescription>{t("embeddedAgent.offlineBody")}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-6">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold leading-none tracking-tight">
            {t("embeddedAgent.title")}
          </h2>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {thread.data ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {t("embeddedAgent.statusLine", {
                  idShort: shortenId(thread.data.thread_id),
                  status: thread.data.status,
                })}
              </p>
              {thread.data.resumed ? (
                <Badge variant="secondary">{t("embeddedAgent.resumedBadge")}</Badge>
              ) : null}
            </div>
          ) : null}
          <p className="text-sm">{t("embeddedAgent.placeholderBody")}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleBack}>
              {t("embeddedAgent.backCta")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">{t("embeddedAgent.restartCta")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("embeddedAgent.restartConfirmTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("embeddedAgent.restartConfirmBody")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t("embeddedAgent.restartCancelCta")}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmRestart}>
                    {t("embeddedAgent.restartConfirmCta")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
