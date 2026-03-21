import { useEffect, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAIGenerateProgram, isNetworkError, isQuotaError } from "@/hooks/useAIGenerateProgram"
import { useExerciseLibrary } from "@/hooks/useExerciseLibrary"
import type { GenerateProgramConstraints, AIGeneratedProgram } from "@/types/aiProgram"

interface AIGeneratingStepProps {
  constraints: GenerateProgramConstraints
  onSuccess: (result: AIGeneratedProgram) => void
  onFallbackTemplate: () => void
  onFallbackBlank: () => void
}

const PHASE_INTERVAL_MS = 2400

export function AIGeneratingStep({
  constraints,
  onSuccess,
  onFallbackTemplate,
  onFallbackBlank,
}: AIGeneratingStepProps) {
  const { t } = useTranslation("create-program")
  const { data: exercisePool } = useExerciseLibrary()
  const mutation = useAIGenerateProgram({ exercisePool: exercisePool ?? [] })
  const inflight = useRef(false)
  const [attempt, retry] = useReducer((n: number) => n + 1, 0)

  const phases = [
    t("genPhase1"),
    t("genPhase2"),
    t("genPhase3"),
    t("genPhase4"),
  ]
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % phases.length)
    }, PHASE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [phases.length])

  useEffect(() => {
    if (inflight.current || !exercisePool) return
    inflight.current = true

    mutation
      .mutateAsync(constraints)
      .then(onSuccess)
      .catch(() => {})
      .finally(() => { inflight.current = false })
  }, [exercisePool, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (mutation.isError) {
    const err = mutation.error
    const quota = isQuotaError(err)
    const isNetwork = isNetworkError(err)
    const isTimeout = err instanceof Error && err.message === "timeout"

    const message = quota
      ? t("errorQuota")
      : isNetwork
        ? t("errorNetwork")
        : isTimeout
          ? t("errorTimeout")
          : t("errorGeneric")

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <p className="text-center text-sm text-muted-foreground">{message}</p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {!quota && (
            <Button onClick={() => { mutation.reset(); retry() }}>
              {t("retry")}
            </Button>
          )}
          <Button variant="outline" onClick={onFallbackTemplate}>
            {t("useTemplate")}
          </Button>
          <Button variant="ghost" onClick={onFallbackBlank}>
            {t("startBlank")}
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
        {Array.from({ length: Math.min(constraints.daysPerWeek, 6) }).map((_, i) => (
          <div
            key={i}
            className="animate-in fade-in slide-in-from-left-4 flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-3 duration-500 fill-mode-backwards"
            style={{ animationDelay: `${800 + i * 400}ms` }}
          >
            <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" style={{ animationDelay: `${i * 100}ms` }} />
              <div className="h-2.5 w-16 animate-pulse rounded bg-muted/60" style={{ animationDelay: `${i * 100 + 50}ms` }} />
            </div>
            <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  )
}
