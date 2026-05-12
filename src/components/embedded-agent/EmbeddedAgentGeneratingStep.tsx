import { useEffect, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  useGenerateDraft,
  type EmbeddedAgentError,
} from "@/hooks/useEmbeddedAgentThread"
import { useTrackEvent } from "@/hooks/useTrackEvent"
import { captureEmbeddedAgentError } from "@/lib/sentry"

const PHASE_INTERVAL_MS = 2400

// Skeleton day cards are decorative only — we don't know the user's
// `training_days_per_week` here without an extra fetch, and showing 4 is
// a sensible default (matches the median onboarding choice). The cards
// disappear the moment the mutation resolves anyway.
const SKELETON_DAY_COUNT = 4

// T135 (#343) — see EmbeddedAgentChatStep for rationale on the constrained
// namespace / purpose vocabulary.
type EmbeddedAgentI18nNamespace = "onboarding" | "create-program"
type EmbeddedAgentPurpose = "onboarding" | "additional_program"

interface EmbeddedAgentGeneratingStepProps {
  locale: "en" | "fr"
  onSuccess: () => void
  onFallbackTemplate: () => void
  onFallbackBlank: () => void
  // T135 (#343) — see EmbeddedAgentChatStep for context.
  purpose: EmbeddedAgentPurpose
  i18nNamespace: EmbeddedAgentI18nNamespace
}

export function EmbeddedAgentGeneratingStep({
  locale,
  onSuccess,
  onFallbackTemplate,
  onFallbackBlank,
  purpose,
  i18nNamespace,
}: EmbeddedAgentGeneratingStepProps) {
  // T135 (#343) — the gen phases / fallback CTA copy lives in the
  // `create-program` namespace historically; even from onboarding we
  // already double-loaded that namespace to reuse them. The
  // surface-specific copy (titles, quota bodies, etc.) flips with
  // `i18nNamespace` so additional-program can override them without
  // touching onboarding strings.
  const { t: tCp } = useTranslation("create-program")
  const { t } = useTranslation(i18nNamespace)
  const mutation = useGenerateDraft(purpose)
  const trackEvent = useTrackEvent()
  const inflight = useRef(false)
  const [attempt, retry] = useReducer((n: number) => n + 1, 0)

  const phases = [
    tCp("genPhase1"),
    tCp("genPhase2"),
    tCp("genPhase3"),
    tCp("genPhase4"),
  ]
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % phases.length)
    }, PHASE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [phases.length])

  // Fire the mutation on mount (and on retry). Guarded by `inflight`
  // ref so StrictMode's double-mount in dev doesn't fire two parallel
  // /draft calls and burn a quota slot.
  useEffect(() => {
    if (inflight.current) return
    inflight.current = true

    // T123 analytics: emit the trigger that kicked off this draft so
    // funnel and quota dashboards can split user-driven vs (future)
    // auto-triggered drafts. Only `user_cta` ships today; the server
    // type accepts `ready_signal` and `turn_cap` for the future
    // self-driving flow described in the Tech Plan.
    trackEvent.mutate({
      eventType: "embedded_agent_draft_triggered",
      payload: { trigger: "user_cta", attempt },
    })

    mutation
      .mutateAsync({ trigger: "user_cta", locale })
      .then(() => onSuccess())
      .catch((err) => {
        // T122: surface fatal /draft errors to Sentry. The helper
        // returns early on quota / friendly UX kinds so this stays
        // signal, not noise.
        captureEmbeddedAgentError("/draft", err as EmbeddedAgentError)
      })
      .finally(() => {
        inflight.current = false
      })
  }, [attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (mutation.isError) {
    const err = mutation.error as EmbeddedAgentError
    const isQuota = err.kind === "quota"
    // Map our typed error kinds onto the legacy copy. We don't have an
    // explicit "network" / "timeout" branch for /draft yet — the edge
    // function wraps them as `model_failure` / `mcp_failed`. Both fall
    // into the generic bucket.
    const message = isQuota
      ? err.which === "draft"
        ? t("embeddedAgent.draftQuotaBody")
        : err.which === "program"
          ? t("embeddedAgent.programQuotaBody")
          : tCp("errorQuota")
      : tCp("errorGeneric")

    const title = isQuota
      ? err.which === "draft"
        ? t("embeddedAgent.draftQuotaTitle")
        : err.which === "program"
          ? t("embeddedAgent.programQuotaTitle")
          : t("embeddedAgent.errorTitle")
      : t("embeddedAgent.errorTitle")

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <div className="flex max-w-sm flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          {!isQuota && (
            <Button
              onClick={() => {
                mutation.reset()
                retry()
              }}
            >
              {tCp("retry")}
            </Button>
          )}
          <Button variant="outline" onClick={onFallbackTemplate}>
            {tCp("useTemplate")}
          </Button>
          <Button variant="ghost" onClick={onFallbackBlank}>
            {tCp("startBlank")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-primary/10" />
        <Sparkles className="relative h-7 w-7 text-primary" />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <p
          key={phase}
          role="status"
          aria-live="polite"
          className="animate-in fade-in slide-in-from-bottom-2 text-sm font-medium duration-300"
        >
          {phases[phase]}
        </p>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex w-full max-w-sm flex-col gap-2.5">
        {Array.from({ length: SKELETON_DAY_COUNT }).map((_, i) => (
          <div
            key={i}
            className="animate-in fade-in slide-in-from-left-4 flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-3 duration-500 fill-mode-backwards"
            style={{ animationDelay: `${800 + i * 400}ms` }}
          >
            <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div
                className="h-3 w-24 animate-pulse rounded bg-muted"
                style={{ animationDelay: `${i * 100}ms` }}
              />
              <div
                className="h-2.5 w-16 animate-pulse rounded bg-muted/60"
                style={{ animationDelay: `${i * 100 + 50}ms` }}
              />
            </div>
            <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  )
}
