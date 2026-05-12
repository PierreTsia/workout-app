import { useCallback, useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { dayEmojiForProgramDayIndex } from "@/lib/programPersistence"
import {
  useCommitPreview,
  useRejectPreview,
  useThread,
  type DraftPreview,
  type EmbeddedAgentError,
} from "@/hooks/useEmbeddedAgentThread"
import { useTrackEvent } from "@/hooks/useTrackEvent"
import { captureEmbeddedAgentError } from "@/lib/sentry"

// Threshold above which the "you're stuck — try a template or start blank"
// escape Alert appears (Story 15). 2 matches the ticket's contract: one
// failure is forgivable, two in a row means the AI flow probably isn't the
// right tool right now and the user deserves a one-click out.
const FAILURE_THRESHOLD = 2

const FAILURE_KEY_PREFIX = "embedded_agent_failures::"

// T135 (#343) — see EmbeddedAgentChatStep for rationale on the constrained
// namespace / purpose vocabulary.
type EmbeddedAgentI18nNamespace = "onboarding" | "create-program"
type EmbeddedAgentPurpose = "onboarding" | "additional_program"

interface EmbeddedAgentPreviewStepProps {
  locale: "en" | "fr"
  onRegenerate: () => void
  onCommitted: (programId: string) => void
  onFallbackTemplate: () => void
  onFallbackBlank: () => void
  // T135 (#343) — see EmbeddedAgentChatStep for context.
  purpose: EmbeddedAgentPurpose
  i18nNamespace: EmbeddedAgentI18nNamespace
}

export function EmbeddedAgentPreviewStep({
  locale,
  onRegenerate,
  onCommitted,
  onFallbackTemplate,
  onFallbackBlank,
  purpose,
  i18nNamespace,
}: EmbeddedAgentPreviewStepProps) {
  const { t } = useTranslation(i18nNamespace)
  const thread = useThread(purpose, locale)
  const commit = useCommitPreview(purpose)
  const reject = useRejectPreview(purpose)
  const trackEvent = useTrackEvent()

  const threadId = thread.data?.thread_id ?? null
  const { count: failureCount, bump: bumpFailureCount } = useFailureCount(threadId)

  const handleConfirm = useCallback(async () => {
    try {
      const result = await commit.mutateAsync()
      // T136 (#343) — fire `embedded_agent_preview_committed` on success
      // so the funnel can join end-to-end (open → message → draft →
      // commit) without joining on thread_id. `motivation` is null for
      // onboarding (the motivation gate is additional-program-only); we
      // still send it so downstream queries can count "with motivation /
      // without motivation" without forking on purpose.
      trackEvent.mutate({
        eventType: "embedded_agent_preview_committed",
        payload: {
          thread_id: result.thread_id,
          program_id: result.program_id,
          purpose,
          motivation: result.motivation,
          locale,
        },
      })
      onCommitted(result.program_id)
    } catch (err) {
      // Bump on every commit failure — the cap on this is the threshold,
      // not the underlying error type. The mutation's `error` state still
      // surfaces the inline banner.
      bumpFailureCount()
      // T122: surface fatal /commit errors to Sentry. The helper
      // returns early on `no_active_thread` (precondition drift, the UI
      // already handles it).
      captureEmbeddedAgentError("/commit", err as EmbeddedAgentError)
    }
  }, [commit, onCommitted, bumpFailureCount, trackEvent, purpose, locale])

  const handleRegenerate = useCallback(async () => {
    // T123 analytics: fire on intent (before the network call) so a
    // /reject failure still counts the user's choice. The funnel cares
    // about "user said no to this draft", not "/reject succeeded".
    trackEvent.mutate({
      eventType: "embedded_agent_preview_rejected",
      // T136 (#343) — `purpose` joined the payload so the funnel can
      // split rejections by flow.
      payload: { thread_id: threadId, failure_count: failureCount, purpose },
    })
    try {
      await reject.mutateAsync()
    } finally {
      // Always step back to chat — even if /reject fails the client should
      // route the user away from the now-stale preview screen.
      onRegenerate()
    }
  }, [reject, onRegenerate, trackEvent, threadId, failureCount, purpose])

  if (thread.isLoading) {
    return <p className="px-6 py-8 text-sm text-muted-foreground">…</p>
  }

  const preview = thread.data?.last_preview ?? null

  if (!preview) {
    return (
      <Card className="m-6 flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base font-medium">
          {t("embeddedAgentPreview.missingPreview")}
        </p>
        <Button variant="outline" onClick={onRegenerate}>
          {t("embeddedAgentPreview.backToChatCta")}
        </Button>
      </Card>
    )
  }

  const programDays = preview.args.days.length
  const programExerciseCount = preview.args.days.reduce(
    (sum, d) => sum + d.exercises.length,
    0,
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader className="space-y-1">
          <h2 className="text-lg font-semibold">
            {t("embeddedAgentPreview.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("embeddedAgentPreview.subtitle")}
          </p>
          <p className="text-sm font-medium">{preview.args.name}</p>
          <p className="text-xs text-muted-foreground">
            {t("embeddedAgentPreview.programLine", {
              days: programDays,
              exercises: programExerciseCount,
            })}
          </p>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto">
          <PreviewBody preview={preview} i18nNamespace={i18nNamespace} />
        </CardContent>

        {commit.error ? (
          <CommitErrorBanner
            error={commit.error}
            onRetry={handleConfirm}
            disabled={commit.isPending}
            i18nNamespace={i18nNamespace}
          />
        ) : null}

        {failureCount >= FAILURE_THRESHOLD ? (
          <FallbackEscape
            onTemplate={onFallbackTemplate}
            onBlank={onFallbackBlank}
            i18nNamespace={i18nNamespace}
          />
        ) : null}

        <div className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={reject.isPending || commit.isPending}
          >
            {reject.isPending
              ? t("embeddedAgentPreview.regeneratingStatus")
              : t("embeddedAgentPreview.regenerateCta")}
          </Button>
          <Button onClick={handleConfirm} disabled={commit.isPending}>
            {commit.isPending
              ? t("embeddedAgentPreview.confirmingStatus")
              : t("embeddedAgentPreview.confirmCta")}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ---------- subcomponents ----------

// Many models prepend "Day 1:" / "Day 2 -" to the day label, which then
// double-labels alongside our own day-index emoji. Strip the prefix so the
// label reads cleanly ("Upper Body — Push Focus" instead of
// "Day 1: Upper Body — Push Focus").
const DAY_PREFIX_RE = /^(?:day|jour|jr)\s*\d+\s*[:\-—–]\s*/i

function cleanDayLabel(raw: string): string {
  return raw.replace(DAY_PREFIX_RE, "").trim() || raw
}

// MCP echo lines come pre-formatted as "Name — sets×reps × weight — rest".
// Split on the FIRST " — " so the exercise name stays whole even when the
// metadata side contains additional em-dashes. Falls back to "name only"
// when there's no separator.
function parseLine(line: string): { name: string; tail: string } {
  const idx = line.indexOf(" — ")
  if (idx === -1) return { name: line.trim(), tail: "" }
  return {
    name: line.slice(0, idx).trim(),
    tail: line.slice(idx + " — ".length).replaceAll(" — ", " · ").trim(),
  }
}

interface DayDescriptor {
  label: string
  exerciseCount: number
  // When `lines` is present we render structured rows from MCP echo;
  // otherwise we fall back to the count-only summary (legacy / size-guarded
  // / catalog-starved threads).
  lines?: string[]
}

function PreviewBody({
  preview,
  i18nNamespace,
}: {
  preview: DraftPreview
  i18nNamespace: EmbeddedAgentI18nNamespace
}) {
  // Build a unified day descriptor list so the expand/collapse logic
  // doesn't fork between rendered and args-only paths. The Array.isArray
  // guard also catches legacy persisted threads where `rendered` was stored
  // as a single string before T120 reshaped it into RenderedDay[] — those
  // get treated as "no rendered" and gracefully degrade to args-only.
  const hasRendered = Array.isArray(preview.rendered) && preview.rendered.length > 0
  const days: DayDescriptor[] = hasRendered
    ? preview.rendered!.map((d, i) => ({
        label: cleanDayLabel(d.label),
        exerciseCount:
          d.lines.length || preview.args.days[i]?.exercises.length || 0,
        lines: d.lines,
      }))
    : preview.args.days.map((d) => ({
        label: cleanDayLabel(d.label),
        exerciseCount: d.exercises.length,
      }))

  // Default-expand the first day so the user lands on something concrete.
  // Single-expanded behavior matches the legacy AIProgramPreviewStep.
  const [expandedDay, setExpandedDay] = useState<number | null>(0)

  return (
    <div className="flex flex-col gap-2">
      {days.map((day, i) => (
        <DayCard
          key={`${day.label}-${i}`}
          index={i}
          day={day}
          isExpanded={expandedDay === i}
          onToggle={() => setExpandedDay(expandedDay === i ? null : i)}
          i18nNamespace={i18nNamespace}
        />
      ))}
    </div>
  )
}

interface DayCardProps {
  index: number
  day: DayDescriptor
  isExpanded: boolean
  onToggle: () => void
  i18nNamespace: EmbeddedAgentI18nNamespace
}

function DayCard({ index, day, isExpanded, onToggle, i18nNamespace }: DayCardProps) {
  const { t } = useTranslation(i18nNamespace)
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span>{dayEmojiForProgramDayIndex(index)}</span>
          <div>
            <div className="text-sm font-medium">{day.label}</div>
            <div className="text-xs text-muted-foreground">
              {t("embeddedAgentPreview.exercisesCount", { count: day.exerciseCount })}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isExpanded ? (
        <div className="border-t px-3 pb-3">
          {day.lines && day.lines.length > 0 ? (
            day.lines.map((line, j) => {
              const { name, tail } = parseLine(line)
              return (
                <div
                  key={j}
                  className="flex flex-col gap-1 border-b border-border/50 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <span className="text-sm font-medium">{name}</span>
                  {tail ? (
                    <span className="text-xs text-muted-foreground">{tail}</span>
                  ) : null}
                </div>
              )
            })
          ) : (
            // No MCP echo lines — surface a soft hint instead of an empty
            // expand. This is the legacy / size-guarded / catalog-starved
            // path and the user can still confirm or regenerate from here.
            <p className="py-2 text-xs italic text-muted-foreground">
              {t("embeddedAgentPreview.argsFallbackHint")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function CommitErrorBanner({
  error,
  onRetry,
  disabled,
  i18nNamespace,
}: {
  error: EmbeddedAgentError
  onRetry: () => void
  disabled: boolean
  i18nNamespace: EmbeddedAgentI18nNamespace
}) {
  const { t } = useTranslation(i18nNamespace)
  // We display the same friendly title for both `commit_failed` and
  // `no_active_thread` here — the distinction matters for navigation
  // (the page wrapper handles bouncing back to chat on no_active_thread)
  // but not for the inline retry copy.
  const isStateDrift = error.kind === "no_active_thread"
  return (
    <Alert variant="destructive" className="mx-4 my-2">
      <AlertTitle>
        {isStateDrift
          ? t("embeddedAgentPreview.noActiveThreadTitle")
          : t("embeddedAgentPreview.commitErrorTitle")}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {isStateDrift
            ? t("embeddedAgentPreview.noActiveThreadBody")
            : t("embeddedAgentPreview.commitErrorBody")}
        </span>
        {!isStateDrift && (
          <Button size="sm" variant="outline" onClick={onRetry} disabled={disabled}>
            {t("embeddedAgentPreview.commitRetryCta")}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

function FallbackEscape({
  onTemplate,
  onBlank,
  i18nNamespace,
}: {
  onTemplate: () => void
  onBlank: () => void
  i18nNamespace: EmbeddedAgentI18nNamespace
}) {
  const { t } = useTranslation(i18nNamespace)
  return (
    <Alert className="mx-4 my-2">
      <AlertTitle>{t("embeddedAgentPreview.stuckTitle")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{t("embeddedAgentPreview.stuckBody")}</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onTemplate}>
            {t("embeddedAgentPreview.stuckTemplateCta")}
          </Button>
          <Button variant="outline" onClick={onBlank}>
            {t("embeddedAgentPreview.stuckBlankCta")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

// ---------- failure counter ----------

/**
 * SessionStorage-backed per-thread failure counter for the 2-failure escape
 * (Story 15). Scoped to thread id so a fresh thread starts fresh, persists
 * across reloads in the same tab, and disappears naturally on tab close.
 *
 * Implemented via `useSyncExternalStore` so the read path stays declarative
 * (no set-state-in-effect), survives threadId changes after mount (the
 * initial `getSnapshot` re-runs when threadId changes), and the bump can
 * notify subscribers without a `storage` event (which only fires across
 * tabs anyway).
 */
const failureListeners = new Set<() => void>()

function useFailureCount(threadId: string | null): { count: number; bump: () => void } {
  const subscribe = useCallback((onChange: () => void) => {
    failureListeners.add(onChange)
    return () => {
      failureListeners.delete(onChange)
    }
  }, [])

  const getSnapshot = useCallback(() => readFailureCount(threadId), [threadId])

  // SSR fallback — safe default for non-browser environments where
  // sessionStorage doesn't exist.
  const count = useSyncExternalStore(subscribe, getSnapshot, () => 0)

  const bump = useCallback(() => {
    if (!threadId) return
    const current = readFailureCount(threadId)
    try {
      sessionStorage.setItem(FAILURE_KEY_PREFIX + threadId, String(current + 1))
    } catch {
      // sessionStorage failures (private mode, full quota) are non-fatal:
      // listeners get notified and any in-memory mirror updates, just
      // doesn't survive reloads. Worth a console.warn? Probably noise.
    }
    failureListeners.forEach((fn) => fn())
  }, [threadId])

  return { count, bump }
}

function readFailureCount(threadId: string | null): number {
  if (!threadId || typeof sessionStorage === "undefined") return 0
  try {
    const raw = sessionStorage.getItem(FAILURE_KEY_PREFIX + threadId)
    const parsed = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}
