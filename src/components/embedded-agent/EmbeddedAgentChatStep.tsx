import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
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
  type BundleSummary,
  type EmbeddedAgentError,
  type ThreadMessage,
} from "@/hooks/useEmbeddedAgentThread"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useTrackEvent } from "@/hooks/useTrackEvent"
import { captureEmbeddedAgentError } from "@/lib/sentry"
import { cn } from "@/lib/utils"

// CTA visibility gate. Originally 4 per the ticket, lowered to 2 after
// real-user feedback: by the time the assistant has answered twice
// most users have already shared everything they want to share, and
// hiding the CTA past that felt artificial. The pulse + ready-signal
// behaviour still kicks in only when the model emits the literal
// READY_FOR_PROGRAM_DRAFT JSON line — so the visual upgrade still
// rewards "the model said it's ready", we just don't gate visibility
// itself behind a tour-de-table count anymore.
const CTA_MIN_ASSISTANT_TURNS = 2

// T135 (#343) — i18n namespaces this component supports. Onboarding is the
// historical home; create-program is added in T136 when CreateProgramPage
// adopts this component for the additional-program flow. Constraining the
// type at this layer means a future bilan-mensuel flow (Story 27) must
// declare its namespace before it can render the chat.
type EmbeddedAgentI18nNamespace = "onboarding" | "create-program"
type EmbeddedAgentPurpose = "onboarding" | "additional_program"

interface EmbeddedAgentChatStepProps {
  locale: "en" | "fr"
  onBack: () => void
  // Fired when the user clicks the "Generate my plan" CTA — pure
  // navigation. The actual /draft mutation runs in
  // EmbeddedAgentGeneratingStep so the user sees a proper animated
  // loading screen instead of a disabled button on top of the chat.
  onGenerateRequest?: () => void
  // Fired when the chat step detects it was resumed onto an existing
  // preview_ready thread (no fresh draft needed). Lets the wizard hop
  // straight to the preview screen via the "View your draft" CTA.
  onPreviewReady?: () => void
  // T135 (#343) — threading purpose so the hooks scope their thread
  // queries / mutations correctly (T131 makes `purpose` part of the
  // cache key).
  purpose: EmbeddedAgentPurpose
  // T135 (#343) — which i18n namespace the surface should consume.
  // Onboarding keeps "onboarding" verbatim; CreateProgramPage (T136)
  // passes "create-program" so additional-flow copy can diverge.
  i18nNamespace: EmbeddedAgentI18nNamespace
}

const SHORT_ID_LENGTH = 8

function shortenId(id: string): string {
  return id.slice(0, SHORT_ID_LENGTH)
}

export function EmbeddedAgentChatStep({
  locale,
  onBack,
  onGenerateRequest,
  onPreviewReady,
  purpose,
  i18nNamespace,
}: EmbeddedAgentChatStepProps) {
  const { t } = useTranslation(i18nNamespace)
  const isOnline = useOnlineStatus()
  const thread = useThread(purpose, locale)
  const abandon = useAbandonThread(purpose)
  const sendMessage = useSendMessage(purpose)
  const trackEvent = useTrackEvent()
  const [draft, setDraft] = useState("")
  // Latch the ready-signal so the CTA pulse persists across subsequent
  // turns instead of disappearing the moment the user replies and the
  // last `/message` payload turns into stale `data`.
  const [hasReadySignal, setHasReadySignal] = useState(false)

  // Pulse the CTA the moment the model emits READY_FOR_PROGRAM_DRAFT.
  // Mutating state inside an effect (vs. derived from `sendMessage.data`
  // directly) keeps the latch sticky across follow-up turns.
  // NOTE: must stay above the early-return for React's hook-order rule.
  useEffect(() => {
    if (sendMessage.data?.ready_for_draft) setHasReadySignal(true)
  }, [sendMessage.data])

  // PR review #7: report /thread fetch failures to Sentry once per error
  // (not on every re-render). Friendly UX kinds are filtered out by
  // `captureEmbeddedAgentError`.
  //
  // `useThread` is a `useQuery`, not a mutation — its TError defaults to
  // plain `Error` (not `EmbeddedAgentError`), because `callEmbeddedAgent`
  // throws raw `Error` instances on supabase invoke failures. We wrap
  // into the canonical `kind: "unknown"` shape so the Sentry helper's
  // `error.kind` accesses don't surface as `undefined` tags.
  useEffect(() => {
    if (!thread.isError) return
    const err = thread.error
    const wrapped: EmbeddedAgentError = {
      kind: "unknown",
      message: err instanceof Error ? err.message : String(err),
    }
    captureEmbeddedAgentError("/thread", wrapped)
  }, [thread.isError, thread.error])

  // Story 8 + PR review #7: never trap the user in an infinite spinner when
  // the network is gone, but DON'T conflate a real offline event with a
  // /thread query error. A 401/RLS/5xx surfacing as "You're offline" is
  // misleading and blocks recovery (the user keeps refreshing instead of
  // re-authenticating). We split:
  //   - `!isOnline`         → genuine offline banner (no retry — comes back
  //                            for free when navigator.onLine flips)
  //   - `thread.isError`    → "couldn't load conversation" banner with an
  //                            explicit Retry that re-runs the query
  if (!isOnline) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-6 py-6">
        <Alert>
          <AlertTitle>{t("embeddedAgent.offlineTitle")}</AlertTitle>
          <AlertDescription>{t("embeddedAgent.offlineBody")}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (thread.isError) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-6 py-6">
        <ErrorBanner
          title={t("embeddedAgent.threadErrorTitle")}
          body={t("embeddedAgent.threadErrorBody")}
          retryLabel={t("embeddedAgent.retryCta")}
          onRetry={() => {
            void thread.refetch()
          }}
        />
      </div>
    )
  }

  const handleConfirmRestart = async () => {
    await abandon.mutateAsync()
    sendMessage.reset()
    setHasReadySignal(false)
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
      const response = await sendMessage.mutateAsync({ content: trimmed, locale })
      // T123 analytics: count successful user turns only. Quota / model
      // failures are already tracked server-side via `ai_generation_log`
      // (log_everything) — re-counting them client-side would double-bill
      // the funnel. `ready_for_draft` is captured so the funnel can
      // measure how often the model self-signals readiness vs the user
      // pulls the trigger via the CTA on their own.
      //
      // T136 (#343) — `purpose` is added so funnel queries can split
      // onboarding vs additional_program without joining on thread_id.
      trackEvent.mutate({
        eventType: "embedded_agent_message_sent",
        payload: {
          thread_id: thread.data?.thread_id,
          ready_for_draft: response.ready_for_draft === true,
          purpose,
        },
      })
      // T136 (#343) — additional-program validator rejections surface in
      // the response payload (server keeps the conversation alive). Fire
      // a dedicated event so we can monitor the motivation-classification
      // pain points without grepping logs. Onboarding never emits this
      // (no validator on that purpose).
      if (response.validator_rejection) {
        trackEvent.mutate({
          eventType: "embedded_agent_motivation_classification_failed",
          payload: {
            thread_id: thread.data?.thread_id,
            purpose,
            rejection_reason: response.validator_rejection.reason,
            field: response.validator_rejection.field,
            locale,
          },
        })
      }
    } catch (err) {
      // Error is already typed on `sendMessage.error`; the UI branch
      // reads from there. We additionally fan out to Sentry for fatal
      // shapes (T122) — `captureEmbeddedAgentError` no-ops on the
      // friendly UX kinds (quota, no_active_thread).
      captureEmbeddedAgentError("/message", err as EmbeddedAgentError)
    }
  }

  const messages = thread.data?.messages ?? []
  const assistantTurnCount = messages.filter((m) => m.role === "assistant").length
  // Resumed threads can land here in `preview_ready` (the user closed the
  // tab on the preview screen and came back). Hiding the Generate CTA in
  // that case prevents the inevitable 409 from /draft (which only accepts
  // status=open) and we surface a "View your draft" CTA instead so the
  // user has an obvious path forward to the preview they already paid for.
  const isPreviewReady = thread.data?.status === "preview_ready"
  const showGenerateCta =
    !isPreviewReady &&
    assistantTurnCount >= CTA_MIN_ASSISTANT_TURNS &&
    Boolean(onGenerateRequest)
  const showViewDraftCta = isPreviewReady && Boolean(onPreviewReady)

  const sendError = sendMessage.error as EmbeddedAgentError | null
  // Quota / fatal banners shown HERE only cover /message — /draft errors
  // surface in EmbeddedAgentGeneratingStep where the mutation now lives.
  const isTurnQuotaError =
    sendError?.kind === "quota" &&
    sendError.which !== "draft" &&
    sendError.which !== "program"
  const isFatalError = sendError !== null && sendError.kind !== "quota"
  const composeDisabled = sendMessage.isPending || isTurnQuotaError

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

          {/* T136 (#343) — additional-program threads surface a compact
              context chip so the user knows the assistant is iterating
              on top of their existing program, not starting from
              scratch. Bundle is server-truthed via /open. Onboarding
              threads never receive this payload. */}
          {purpose === "additional_program" && thread.data?.bundle_summary ? (
            <BundleSummaryChip
              summary={thread.data.bundle_summary}
              i18nNamespace={i18nNamespace}
            />
          ) : null}

          <DisclosureCard i18nNamespace={i18nNamespace} />
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden pb-4">
          <ChatTranscript
            messages={messages}
            placeholderBody={t("embeddedAgent.placeholderBody")}
            isAssistantTyping={sendMessage.isPending}
            assistantTypingLabel={t("embeddedAgent.assistantTyping")}
          />

          {isTurnQuotaError ? (
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
              onRetry={() => {
                sendMessage.reset()
              }}
            />
          ) : null}

          {showGenerateCta ? (
            <GenerateCta
              label={t("embeddedAgent.generateCta")}
              pulsing={hasReadySignal}
              onClick={() => onGenerateRequest?.()}
            />
          ) : null}

          {showViewDraftCta ? (
            <Button
              type="button"
              size="lg"
              className="mx-4 my-2 sm:mx-6"
              onClick={() => onPreviewReady?.()}
            >
              {t("embeddedAgent.viewDraftCta")}
            </Button>
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

interface GenerateCtaProps {
  label: string
  pulsing: boolean
  onClick: () => void
}

function GenerateCta({ label, pulsing, onClick }: GenerateCtaProps) {
  return (
    <div className="flex flex-shrink-0 flex-col gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
      <Button
        type="button"
        size="lg"
        onClick={onClick}
        // Pulse signals the model just emitted READY_FOR_PROGRAM_DRAFT —
        // it's a "you can press me now" hint, not a loading indicator.
        // Loading state lives in EmbeddedAgentGeneratingStep on the next
        // wizard step.
        className={cn("self-stretch", pulsing && "animate-pulse")}
      >
        {label}
      </Button>
    </div>
  )
}

// T121 — inline non-blocking privacy disclosure shown above the chat.
// Renders on every onboarding session by design (no dismiss state in v1)
// so the surface stays deterministic and the GA flag flip is defensible.
// Body and link are split into two i18n keys so the link can be a real
// React Router <Link> (no Trans gymnastics) and the FR/EN copy can vary
// the body sentence without touching the link label.
// T136 (#343) — compact context chip surfaced only on the additional-
// program flow. Renders one of two copy variants depending on whether
// the user has an active program: "Building on top of X · N/wk" or
// "No active program · N/wk recently". `sessionsPerWeek === 0` is
// rendered verbatim — it's the correct number for a returning user
// who hasn't trained in 4 weeks and tells the model not to assume
// momentum.
function BundleSummaryChip({
  summary,
  i18nNamespace,
}: {
  summary: BundleSummary
  i18nNamespace: EmbeddedAgentI18nNamespace
}) {
  const { t } = useTranslation(i18nNamespace)
  const label = summary.active_program_name
    ? t("embeddedAgent.bundleChipActive", {
        programName: summary.active_program_name,
        sessionsPerWeek: summary.sessions_per_week,
      })
    : t("embeddedAgent.bundleChipNoActive", {
        sessionsPerWeek: summary.sessions_per_week,
      })
  return (
    <Badge variant="outline" className="w-fit gap-1.5 text-xs font-normal">
      {label}
    </Badge>
  )
}

function DisclosureCard({ i18nNamespace }: { i18nNamespace: EmbeddedAgentI18nNamespace }) {
  const { t } = useTranslation(i18nNamespace)
  return (
    <Alert className="flex-shrink-0 border-primary/20 bg-primary/5">
      <AlertTitle>{t("embeddedAgent.disclosureTitle")}</AlertTitle>
      <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
        {t("embeddedAgent.disclosureBody")}{" "}
        <Link
          to="/privacy"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {t("embeddedAgent.disclosureLink")}
        </Link>
      </AlertDescription>
    </Alert>
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
