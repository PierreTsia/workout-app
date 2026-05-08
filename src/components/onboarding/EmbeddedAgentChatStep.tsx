import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import {
  useAbandonThread,
  useSendMessage,
  useThread,
  type EmbeddedAgentError,
  type ThreadMessage,
} from "@/hooks/useEmbeddedAgentThread"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { cn } from "@/lib/utils"

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
  const sendMessage = useSendMessage()
  const [draft, setDraft] = useState("")

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

  const handleConfirmRestart = async () => {
    await abandon.mutateAsync()
    sendMessage.reset()
    setDraft("")
  }

  const handleBack = async () => {
    await abandon.mutateAsync()
    onBack()
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    setDraft("")
    try {
      await sendMessage.mutateAsync({ content: trimmed, locale })
    } catch {
      // Error is already typed on `sendMessage.error`; the UI branch reads
      // from there. Swallow here so the unhandled rejection doesn't crash
      // the form submit handler.
    }
  }

  const messages = thread.data?.messages ?? []
  const sendError = sendMessage.error as EmbeddedAgentError | null
  const isQuotaError = sendError?.kind === "quota"
  const isFatalError = sendError !== null && !isQuotaError

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-6">
      <Card className="flex flex-1 flex-col">
        <CardHeader>
          <h2 className="text-2xl font-semibold leading-none tracking-tight">
            {t("embeddedAgent.title")}
          </h2>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
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

          <ChatTranscript
            messages={messages}
            placeholderBody={t("embeddedAgent.placeholderBody")}
            isAssistantTyping={sendMessage.isPending}
            assistantTypingLabel={t("embeddedAgent.assistantTyping")}
          />

          {isQuotaError ? (
            <QuotaBanner
              title={t("embeddedAgent.quotaTitle")}
              body={t("embeddedAgent.quotaBody")}
            />
          ) : null}

          {isFatalError ? (
            <ErrorBanner
              title={t("embeddedAgent.errorTitle")}
              body={t("embeddedAgent.errorBody")}
              retryLabel={t("embeddedAgent.retryCta")}
              onRetry={() => sendMessage.reset()}
            />
          ) : null}

          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("embeddedAgent.composePlaceholder")}
              disabled={sendMessage.isPending || isQuotaError}
            />
            <Button
              type="submit"
              disabled={!draft.trim() || sendMessage.isPending || isQuotaError}
            >
              {t("embeddedAgent.sendCta")}
            </Button>
          </form>

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

interface ChatTranscriptProps {
  messages: ThreadMessage[]
  placeholderBody: string
  isAssistantTyping: boolean
  assistantTypingLabel: string
}

function ChatTranscript({
  messages,
  placeholderBody,
  isAssistantTyping,
  assistantTypingLabel,
}: ChatTranscriptProps) {
  return (
    <ScrollArea className="h-64 rounded-md border bg-muted/30 p-3">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{placeholderBody}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.map((m, i) => (
            <li
              key={i}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-card",
              )}
            >
              {m.content}
            </li>
          ))}
        </ul>
      )}
      {isAssistantTyping ? (
        <p className="mt-2 text-xs italic text-muted-foreground" aria-live="polite">
          {assistantTypingLabel}
        </p>
      ) : null}
    </ScrollArea>
  )
}

function QuotaBanner({ title, body }: { title: string; body: string }) {
  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{body}</AlertDescription>
    </Alert>
  )
}

interface ErrorBannerProps {
  title: string
  body: string
  retryLabel: string
  onRetry: () => void
}

function ErrorBanner({ title, body, retryLabel, onRetry }: ErrorBannerProps) {
  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{body}</span>
        <Button size="sm" variant="outline" onClick={onRetry} className="self-start">
          {retryLabel}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
