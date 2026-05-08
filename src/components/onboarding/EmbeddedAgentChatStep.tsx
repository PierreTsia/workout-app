import { useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
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

  const handleSend = async () => {
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
  const composeDisabled = sendMessage.isPending || isQuotaError

  return (
    // min-h-0 is critical: without it, this flex child refuses to shrink
    // below its intrinsic content size and the transcript's
    // `overflow-y-auto` hands the scroll back to the page.
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6 sm:pb-6">
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0 space-y-2">
          <h2 className="text-2xl font-semibold leading-none tracking-tight">
            {t("embeddedAgent.title")}
          </h2>
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
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden pb-4">
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

          <ComposeRow
            value={draft}
            onChange={setDraft}
            onSubmit={handleSend}
            placeholder={t("embeddedAgent.composePlaceholder")}
            sendLabel={t("embeddedAgent.sendCta")}
            disabled={composeDisabled}
          />

          <div className="flex flex-shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              {t("embeddedAgent.backCta")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  {t("embeddedAgent.restartCta")}
                </Button>
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
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the bottom whenever a new turn lands or the typing
  // indicator toggles. useLayoutEffect (not useEffect) runs synchronously
  // after the DOM update but *before* the browser paints — so the new
  // bubble is already measured and we never show a one-frame flash where
  // the message has appeared but the scroll hasn't caught up. We avoid
  // `scrollIntoView` because some browsers escalate it to a page-level
  // scroll when the chat is the tallest element on the page.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, isAssistantTyping])

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto rounded-md border bg-muted/30 p-3"
    >
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{placeholderBody}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <li
              key={i}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-card",
              )}
            >
              {m.role === "assistant" ? (
                <MarkdownContent content={m.content} />
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </li>
          ))}
          {isAssistantTyping ? (
            <li className="mr-auto max-w-[85%]" aria-live="polite">
              <TypingBubble label={assistantTypingLabel} />
            </li>
          ) : null}
        </ul>
      )}
      {isAssistantTyping && messages.length === 0 ? (
        <div className="mt-3" aria-live="polite">
          <TypingBubble label={assistantTypingLabel} />
        </div>
      ) : null}
    </div>
  )
}

function TypingBubble({ label }: { label: string }) {
  // Three dots with staggered bounce delays — mirrors WhatsApp / Telegram's
  // "typing…" affordance. Negative delays kick the wave into motion
  // immediately on mount instead of waiting a full cycle.
  return (
    <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground">
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-300ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      </span>
      <span>{label}</span>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  // Tailwind `prose` would require @tailwindcss/typography (not in the
  // bundle yet); a few targeted overrides give us readable bold / lists /
  // paragraphs without pulling a new dep.
  return (
    <div className="space-y-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

interface ComposeRowProps {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  placeholder: string
  sendLabel: string
  disabled: boolean
}

function ComposeRow({
  value,
  onChange,
  onSubmit,
  placeholder,
  sendLabel,
  disabled,
}: ComposeRowProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-resize: collapse to single-line minimum, then grow with content
  // up to a sensible cap (~6 lines). Synchronous via useLayoutEffect to
  // avoid a single-frame flash on each keystroke. We also flip overflow
  // between hidden (when our JS sets the exact needed height) and auto
  // (only once we hit the cap) — otherwise a phantom scrollbar can appear
  // due to subpixel rounding between scrollHeight and clientHeight.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    const next = Math.min(el.scrollHeight, 200)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > 200 ? "auto" : "hidden"
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Chat convention: Enter sends, Shift+Enter inserts a newline. Cmd/Ctrl
    // composing IME sequences must NOT submit (e.isComposing).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex flex-shrink-0 items-end gap-2"
    >
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="min-h-[44px] resize-none overflow-hidden py-3"
      />
      <Button type="submit" disabled={!value.trim() || disabled}>
        {sendLabel}
      </Button>
    </form>
  )
}

function QuotaBanner({ title, body }: { title: string; body: string }) {
  return (
    <Alert className="flex-shrink-0">
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
    <Alert className="flex-shrink-0">
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
